declare module "@strudel/core" {
  export function evalScope(...modules: unknown[]): Promise<unknown>;
  export function signal(fn: (t: number) => unknown): unknown;
  export function noteToMidi(note: string): number;
}
declare module "@strudel/mini";
declare module "@strudel/tonal";
declare module "@strudel/transpiler" {
  export function evaluate(code: string): Promise<{ pattern: unknown }>;
}
