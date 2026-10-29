import { Worker } from "node:worker_threads";
import type { Ready, Taste, Verdict } from "./validate-worker";

type Taster = { worker: Worker; ready: Promise<Ready | Error> };

const TIMEOUT_MS = Number(process.env.VALIDATE_TIMEOUT_MS ?? 20_000);
const BOOT_TIMEOUT_MS = 120_000;

const WORKER = new URL("./validate-worker.ts", import.meta.url);
const boot = `import { register } from ${JSON.stringify(import.meta.resolve("tsx/esm/api"))};
register();
await import(${JSON.stringify(WORKER.href)});`;

export class Validator {
  private taster: Taster | undefined;
  private queue = Promise.resolve() as Promise<unknown>;

  validate(code: string, key: string): Promise<Verdict> {
    const run = this.queue.then(() => this.run({ code, key }));
    this.queue = run;
    return run;
  }

  close() {
    void this.taster?.worker.terminate();
    this.taster = undefined;
  }

  private async run(taste: Taste) {
    const taster = (this.taster ??= this.spawn());
    const ready = await taster.ready;
    if (ready instanceof Error) {
      this.taster = undefined;
      return { ok: false, problems: [`validation crashed: ${ready.message}`] } satisfies Verdict;
    }
    const worker = taster.worker;
    const timeoutMs = TIMEOUT_MS * ready.slowness;
    return new Promise<Verdict>((resolve) => {
      const done = (verdict: Verdict) => {
        clearTimeout(timer);
        worker.off("message", done);
        worker.off("error", failed);
        resolve(verdict);
      };
      const failed = (err: Error) => {
        this.taster = undefined;
        done({ ok: false, problems: [`validation crashed: ${err.message}`] });
      };
      const timer = setTimeout(() => {
        this.taster = undefined;
        void worker.terminate();
        done({ ok: false, problems: [`the code took longer than ${Math.round(timeoutMs / 1000)} s to evaluate and play`] });
      }, timeoutMs);
      worker.on("message", done);
      worker.on("error", failed);
      worker.postMessage(taste);
    });
  }

  private spawn(): Taster {
    const worker = new Worker(new URL("data:text/javascript," + encodeURIComponent(boot)), {
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    worker.unref();
    const ready = new Promise<Ready | Error>((resolve) => {
      const timer = setTimeout(() => {
        void worker.terminate();
        resolve(new Error(`the validator didn't start within ${BOOT_TIMEOUT_MS / 1000} s`));
      }, BOOT_TIMEOUT_MS);
      const settle = (result: Ready | Error) => {
        clearTimeout(timer);
        resolve(result);
      };
      worker.once("message", settle);
      worker.once("error", settle);
      worker.once("exit", (code) => settle(new Error(`the validator stopped while starting (exit code ${code})`)));
    });
    return { worker, ready };
  }
}
