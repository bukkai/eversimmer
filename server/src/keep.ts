import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Kept } from "./pot";

const fileOf = (dir: string, pot: string) => join(dir, `${pot}.json`);

export function readKept(dir: string, pot: string): Kept | undefined {
  try {
    return JSON.parse(readFileSync(fileOf(dir, pot), "utf8")) as Kept;
  } catch {
    return undefined;
  }
}

export function writeKept(dir: string, pot: string, kept: Kept) {
  mkdirSync(dir, { recursive: true });
  const file = fileOf(dir, pot);
  writeFileSync(`${file}.tmp`, JSON.stringify(kept));
  renameSync(`${file}.tmp`, file);
}
