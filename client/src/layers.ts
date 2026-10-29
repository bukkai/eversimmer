import { parse, type Comment, type Node } from "acorn";
import { DRUM_PARTS } from "../../shared/drums";
import { REGION_PARTS } from "../../shared/regions";

export type Layer = { name: string; about: string };

const muted = new Set<string>();
const heardAt = new Map<string, number>();
const AUDIBLE = 0.003;

Object.assign(globalThis, {
  __layer: (name: string) => (v: unknown) => (v && typeof v === "object" ? { ...v, __layer: name } : v),
});

export function labelLayers(code: string): { code: string; layers: Layer[] } {
  const comments: Comment[] = [];
  let program: Node & { body: any[] };
  try {
    program = parse(code, { ecmaVersion: "latest", onComment: comments }) as any;
  } catch {
    return { code, layers: [] };
  }
  let call = program.body.at(-1)?.type === "ExpressionStatement" ? program.body.at(-1).expression : undefined;
  while (call?.type === "CallExpression" && !(call.callee.type === "Identifier" && call.callee.name === "stack"))
    call = call.callee.type === "MemberExpression" ? call.callee.object : undefined;
  if (call?.type !== "CallExpression") return { code, layers: [] };

  const layers: Layer[] = [];
  const edits: { start: number; end: number; text: string }[] = [];
  call.arguments.forEach((arg: any, i: number) => {
    const spread = arg.type === "SpreadElement";
    const inner = spread ? arg.argument : arg;
    const library = inner.type === "MemberExpression" && !inner.computed ? LIBRARIES[inner.object.name] : undefined;
    const name = inner.type === "Identifier" ? inner.name : library ? inner.property.name : `part ${i + 1}`;
    layers.push({ name, about: library ? aboutPart(library, name) : aboutOf(name, code, program, comments) });
    const source = code.slice(inner.start, inner.end);
    const stamp = `__layer('${name}')`;
    edits.push({
      start: inner.start,
      end: inner.end,
      text: spread ? `(${source}).map(p => p.fmap(${stamp}))` : `(${source}).fmap(${stamp})`,
    });
  });
  let out = code;
  for (const e of edits.reverse()) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { code: out, layers };
}

const LIBRARIES: Record<string, Record<string, { code: string }>> = { regions: REGION_PARTS, drums: DRUM_PARTS };

function aboutPart(library: Record<string, { code: string }>, name: string) {
  const code = library[name]?.code ?? "";
  const comments: Comment[] = [];
  try {
    return aboutOf(name, code, parse(code, { ecmaVersion: "latest", onComment: comments }) as any, comments);
  } catch {
    return "";
  }
}

function aboutOf(name: string, code: string, program: { body: any[] }, comments: Comment[]) {
  const declaration = program.body.find(
    (s) => s.type === "VariableDeclaration" && s.declarations.some((d: any) => d.id.type === "Identifier" && d.id.name === name),
  );
  if (!declaration) return "";
  const blocks: Comment[][] = [];
  for (const c of comments.filter((c) => c.end <= declaration.start)) {
    const last = blocks.at(-1);
    if (last && /^\s*$/.test(code.slice(last.at(-1)!.end, c.start))) last.push(c);
    else blocks.push([c]);
  }
  const blank = (at: number) => /\n\s*\n\s*$/.test(code.slice(0, at)) || !code.slice(0, at).trim();
  const latest = [...blocks].reverse();
  const block =
    latest.find((b) => /^\s*$/.test(code.slice(b.at(-1)!.end, declaration.start))) ?? latest.find((b) => blank(b[0].start));
  if (!block) return "";
  const text = block.map((c) => c.value.trim()).join(" ");
  const sentence = text.match(/^.*?[.;](\s|$)/)?.[0].trim() ?? text;
  return sentence.length > 120 ? sentence.slice(0, 118) + "…" : sentence;
}

export function letThrough(value: unknown) {
  const v = value && typeof value === "object" ? (value as { __layer?: string; gain?: number; velocity?: number }) : {};
  if (v.__layer === undefined) return true;
  if ((v.gain ?? 1) * (v.velocity ?? 1) > AUDIBLE) heardAt.set(v.__layer, performance.now());
  return !muted.has(v.__layer);
}

export const isMuted = (name: string) => muted.has(name);
export const toggle = (name: string) => (muted.has(name) ? muted.delete(name) : muted.add(name));
export const unmuteAll = () => muted.clear();
export function solo(name: string, all: string[]) {
  const alone = !muted.has(name) && all.every((n) => n === name || muted.has(n));
  muted.clear();
  if (!alone) for (const n of all) if (n !== name) muted.add(n);
}
export const heardWithin = (name: string, ms: number) => performance.now() - (heardAt.get(name) ?? -Infinity) < ms;
