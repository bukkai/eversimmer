import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Moment } from "../../shared/protocol";

const FEEDBACK_FILE = process.env.FEEDBACK_FILE ?? fileURLToPath(new URL("../scripts/runs/feedback.jsonl", import.meta.url));
export const MAX_FEEDBACK_LENGTH = 2000;

export function keepMoment(moment: Moment) {
  mkdirSync(dirname(FEEDBACK_FILE), { recursive: true });
  appendFileSync(FEEDBACK_FILE, `${JSON.stringify(moment)}\n`);
}
