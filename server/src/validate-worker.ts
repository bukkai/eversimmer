import { parse } from "acorn";
import { parentPort } from "node:worker_threads";
import { FORM_NAMES, FORM_REST } from "../../shared/form";
import { courseGlobals } from "../../shared/globals";
import { DEFAULT_PALETTE, PALETTE_NAMES, STYLES, trackKey, type Style } from "../../shared/palette";
import { round } from "../../shared/numbers";
import { STONE } from "../../shared/stone";
import { DRUM_MACHINES, levelOf, machineOf } from "../../shared/sounds";
import { loadRegions, REGION_PART_NAMES } from "../../shared/regions";
import { MACROS, type Macro } from "../../shared/macros";
import { loadScore } from "../../shared/score";
import { DRUM_PART_NAMES, loadDrums } from "../../shared/drums";
import { GENRE_NAMES, mapTarget, weightsAt } from "../../shared/map";
import { BROTH_KEYS, foldValue, RESTING_BROTH, scaleFor, type Broth } from "../../shared/types";
import {
  CALLABLE,
  FORBIDDEN_WORDS,
  GLOBALS,
  LIMITS,
  MAX_CODE_LENGTH,
  SOUNDS,
} from "./course-rules";
import { PROBES, STYLE_MIXES, WINDOWS } from "./probes";

export type Taste = { code: string; key: string };
export type Ready = { ready: true; slowness: number };
export type Verdict =
  | { ok: true; eventsPerCycle: number; peakLevel: number; msPerCycle: number }
  | { ok: false; problems: string[] };

const LOUDNESS_CEILING = 3.5;
const MAX_EVENTS_PER_CYCLE = 200;
const MAX_MS_PER_CYCLE = 60;
const STONE_MS_PER_CYCLE = 30;

const { register } = await import("node:module");
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(spec, ctx, next) {
      if (spec === "@kabelsalat/web") return next(${JSON.stringify(import.meta.resolve("@kabelsalat/web").replace(/index\.js$/, "index.mjs"))}, ctx);
      return next(spec, ctx);
    }`),
);

const { log, warn } = console;
console.log = console.warn = () => {};
const core = await import("@strudel/core");
const mini = await import("@strudel/mini");
const tonal = await import("@strudel/tonal");
const { evaluate } = await import("@strudel/transpiler");
await core.evalScope(core, mini, tonal);
Object.assign(console, { log, warn });

const live: Broth = { ...RESTING_BROTH };
let position = mapTarget(RESTING_BROTH);
let moment = FORM_REST;
let palette = DEFAULT_PALETTE;
let style: Record<Style, number> = STYLE_MIXES[0];
let key = "D";
Object.assign(
  globalThis,
  courseGlobals(core.signal, {
    broth: () => live,
    scale: () => scaleFor(trackKey(key, palette.fifths), live.valence, weightsAt(position), palette.parent),
    position: () => position,
    moment: () => moment,
    palette: () => palette,
    tides: () => ({ day: 0.3, season: 0.7 }),
    style: () => style,
  }),
);
await loadScore(evaluate);
await loadDrums(async (code) => (await evaluate(code)).pattern);
await loadRegions(async (code) => (await evaluate(code)).pattern);

function hear(probe: (typeof PROBES)[number]) {
  Object.assign(live, probe.broth);
  position = probe.at;
  moment = probe.moment;
  palette = probe.palette;
  style = probe.style;
}

const slowness = await (async () => {
  const { pattern }: { pattern: any } = await evaluate(STONE);
  const [from, to] = WINDOWS[0];
  const start = performance.now();
  for (const probe of PROBES) {
    hear(probe);
    pattern.queryArc(from, to);
  }
  const msPerCycle = (performance.now() - start) / (PROBES.length * (to - from));
  return Math.max(1, msPerCycle / STONE_MS_PER_CYCLE);
})();
const maxMsPerCycle = MAX_MS_PER_CYCLE * slowness;
if (slowness > 1.2) log(`this machine plays the stone ${slowness.toFixed(1)}× slower than a laptop; the validator allows for that`);

parentPort!.on("message", async (taste: Taste) => {
  let verdict: Verdict;
  const thrown = new Set<string>();
  console.log = (...args: unknown[]) => {
    const line = String(args[0]).replace(/%c/g, "");
    const error = line.match(/\[(?:query|eval)\] error: (.*)/);
    const warning = line.match(/\[warn\]: (.*)/);
    if (error) thrown.add(`the pattern throws while playing: ${error[1].trim()}`);
    else if (warning) thrown.add(`Strudel warns: ${warning[1].trim()}`);
    else log(...args);
  };
  try {
    const problems = readCode(taste.code);
    verdict = problems.length ? { ok: false, problems } : await play(taste);
  } catch (err) {
    verdict = { ok: false, problems: [`validation failed: ${(err as Error).message}`] };
  } finally {
    console.log = log;
  }
  if (thrown.size) verdict = { ok: false, problems: [...thrown, ...(verdict.ok ? [] : verdict.problems)].slice(0, 6) };
  parentPort!.postMessage(verdict);
});
parentPort!.postMessage({ ready: true, slowness } satisfies Ready);

type Node = { type: string; [k: string]: any };

function readCode(code: string): string[] {
  if (code.length > MAX_CODE_LENGTH) return [`the code is ${code.length} characters, the limit is ${MAX_CODE_LENGTH}`];
  let program: Node;
  try {
    program = parse(code, { ecmaVersion: "latest", sourceType: "script" }) as unknown as Node;
  } catch (err) {
    return [`syntax error: ${(err as Error).message}`];
  }
  const problems = new Set<string>();
  const problem = (msg: string) => problems.add(msg);
  const last = program.body[program.body.length - 1];
  if (!last || last.type !== "ExpressionStatement") problem("the code must end with the pattern to play, like stack(...)");

  const declared = new Set<string>();
  walk(program, (node) => {
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier") declared.add(node.id.name);
    if (node.type === "ArrowFunctionExpression")
      for (const p of node.params) if (p.type === "Identifier") declared.add(p.name);
  });

  const brothKeys = new Set<string>();
  const word = (name: string, what: string) => {
    if (FORBIDDEN_WORDS.test(name) || name.startsWith("_")) problem(`${what} "${name}" is not allowed`);
  };

  walk(program, (node, parent, field) => {
    switch (node.type) {
      case "Program":
      case "ExpressionStatement":
      case "ArrayExpression":
      case "ObjectExpression":
      case "LogicalExpression":
      case "ConditionalExpression":
      case "SpreadElement":
      case "BlockStatement":
      case "ReturnStatement":
      case "IfStatement":
      case "EmptyStatement":
      case "TemplateElement":
        return;
      case "VariableDeclaration":
        if (node.kind === "var") problem("use const or let, not var");
        return;
      case "VariableDeclarator":
        if (node.id.type !== "Identifier") problem("destructuring is not allowed");
        return;
      case "ArrowFunctionExpression":
        if (node.async || node.generator) problem("async functions are not allowed");
        if (node.params.some((p: Node) => p.type !== "Identifier")) problem("function parameters must be plain names");
        return;
      case "Property":
        if (node.computed || node.kind !== "init" || node.method) problem("object keys must be plain names");
        else word(node.key.name ?? String(node.key.value), "the key");
        return;
      case "Identifier": {
        if (parent?.type === "Property" && field === "key") return;
        if (parent?.type === "MemberExpression" && field === "property" && !parent.computed) return;
        word(node.name, "the name");
        if (!GLOBALS.has(node.name) && !declared.has(node.name)) problem(`"${node.name}" is not defined or not allowed`);
        return;
      }
      case "MemberExpression":
        if (node.optional) problem("optional chaining is not allowed");
        if (!node.computed) {
          word(node.property.name, "the property");
          if (node.object.type === "Identifier" && node.object.name === "broth") {
            if (node.property.name !== "scale" && !BROTH_KEYS.includes(node.property.name))
              problem(`broth.${node.property.name} does not exist`);
            brothKeys.add(node.property.name);
          }
          if (node.object.type === "Identifier" && node.object.name === "genre" && !GENRE_NAMES.includes(node.property.name))
            problem(`genre.${node.property.name} does not exist`);
          if (node.object.type === "Identifier" && node.object.name === "form" && !(FORM_NAMES as string[]).includes(node.property.name))
            problem(`form.${node.property.name} does not exist`);
          if (node.object.type === "Identifier" && node.object.name === "palette" && !PALETTE_NAMES.includes(node.property.name))
            problem(`palette.${node.property.name} does not exist`);
          if (node.object.type === "Identifier" && node.object.name === "style" && !(STYLES as readonly string[]).includes(node.property.name))
            problem(`style.${node.property.name} does not exist`);
          if (node.object.type === "Identifier" && node.object.name === "macro") {
            const macro = MACROS[node.property.name as Macro];
            if (!macro) problem(`macro.${node.property.name} does not exist`);
            else for (const source of Object.keys(macro.from)) if (source.startsWith("broth.")) brothKeys.add(source.slice(6));
          }
          if (node.object.type === "Identifier" && node.object.name === "drums" && !DRUM_PART_NAMES.includes(node.property.name))
            problem(`drums.${node.property.name} does not exist`);
          if (node.object.type === "Identifier" && node.object.name === "regions" && !REGION_PART_NAMES.includes(node.property.name))
            problem(`regions.${node.property.name} does not exist`);
        } else if (node.property.type === "Literal" && typeof node.property.value !== "number")
          problem("indexing with a string is not allowed");
        return;
      case "CallExpression": {
        const callee = node.callee;
        if (node.optional) problem("optional calls are not allowed");
        if (callee.type === "Identifier") {
          if (!CALLABLE.has(callee.name) && !declared.has(callee.name)) problem(`${callee.name}() is not allowed`);
        } else if (callee.type === "MemberExpression" && !callee.computed) {
          const name = callee.property.name;
          if (!CALLABLE.has(name)) problem(`.${name}() is not allowed`);
          if (name === "scale" && !(node.arguments.length === 1 && isBrothScale(node.arguments[0])))
            problem("pitched parts must use .scale(broth.scale), so they follow the pot's key and the room's mood");
        } else problem("only named functions and methods can be called");
        return;
      }
      case "Literal":
        if (node.regex) problem("regular expressions are not allowed");
        if (typeof node.value === "string") word(node.value, "the string");
        return;
      case "TemplateLiteral":
        if (node.expressions.length) problem("template strings with ${} are not allowed");
        for (const q of node.quasis) word(q.value.raw, "the string");
        return;
      case "BinaryExpression":
        if (["in", "instanceof"].includes(node.operator)) problem(`the ${node.operator} operator is not allowed`);
        if (node.operator === "+" && [node.left, node.right].some((n: Node) => n.type === "TemplateLiteral" || (n.type === "Literal" && typeof n.value === "string")))
          problem("joining strings is not allowed");
        return;
      case "UnaryExpression":
        if (!["-", "+", "!"].includes(node.operator)) problem(`the ${node.operator} operator is not allowed`);
        return;
      default:
        problem(`${describe(node.type)} is not allowed`);
    }
  });

  const read = [...brothKeys].filter((k) => k !== "scale");
  if (read.length < 3) problem(`the course must read the broth: it uses ${read.length ? read.map((k) => `broth.${k}`).join(", ") : "no broth signals"}, use at least three (directly or through the macros)`);
  return [...problems].slice(0, 6);
}

const isBrothScale = (n: Node) =>
  n.type === "MemberExpression" && !n.computed && n.object.type === "Identifier" && n.object.name === "broth" && n.property.name === "scale";

const describe = (type: string) =>
  type
    .replace(/(Statement|Expression|Declaration)$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^/, "a ")
    .replace(/^a ([aeiou])/, "an $1");

function walk(node: Node, visit: (node: Node, parent?: Node, field?: string) => void, parent?: Node, field?: string) {
  visit(node, parent, field);
  for (const [k, v] of Object.entries(node)) {
    if (k === "type" || k === "start" || k === "end") continue;
    if (Array.isArray(v)) {
      for (const c of v) if (c && typeof c.type === "string") walk(c, visit, node, k);
    } else if (v && typeof v === "object" && typeof v.type === "string") walk(v, visit, node, k);
  }
}

async function play({ code, key: k }: Taste): Promise<Verdict> {
  key = k;
  let pattern: any;
  try {
    ({ pattern } = await evaluate(code));
  } catch (err) {
    return { ok: false, problems: [`the code throws when evaluated: ${(err as Error).message}`] };
  }
  if (!pattern || typeof pattern.queryArc !== "function") return { ok: false, problems: ["the code does not end with a pattern"] };

  const problems = new Set<string>();
  let peakLevel = 0;
  let events = 0;
  let queried = 0;
  let ms = 0;

  for (const [p, probe] of PROBES.entries()) {
    hear(probe);
    let audible = 0;
    for (const [from, to] of WINDOWS) {
      let haps: any[];
      const start = performance.now();
      try {
        haps = pattern.queryArc(from, to);
      } catch (err) {
        return { ok: false, problems: [`the pattern throws while playing: ${(err as Error).message}`] };
      }
      ms += performance.now() - start;
      queried += to - from;

      const spans: [begin: number, end: number, level: number][] = [];
      let onsets = 0;
      for (const hap of haps) {
        if (!hap.hasOnset()) continue;
        onsets++;
        const level = checkEvent(hap.value, problems);
        if (level > 0.01) audible++;
        spans.push([Number(hap.whole.begin), Number(hap.whole.end), level]);
      }
      events += onsets;
      const perCycle = onsets / (to - from);
      if (perCycle > MAX_EVENTS_PER_CYCLE)
        problems.add(`${Math.round(perCycle)} events per cycle, the limit is ${MAX_EVENTS_PER_CYCLE}`);
      for (let t = from; t < to; t += 1 / 16) {
        let sum = 0;
        for (const [b, e, level] of spans) if (b <= t && t < e) sum += level;
        peakLevel = Math.max(peakLevel, sum);
      }
    }
    if (audible === 0) problems.add(p === 1 ? "the course falls silent when the room is quiet and low" : "the course makes no sound");
  }

  if (peakLevel > LOUDNESS_CEILING)
    problems.add(`too loud: the summed gain of everything sounding at once reaches ${peakLevel.toFixed(2)}, keep it under ${LOUDNESS_CEILING}`);
  const msPerCycle = ms / queried;
  if (msPerCycle > maxMsPerCycle) problems.add(`too heavy to play: ${msPerCycle.toFixed(1)} ms of work per cycle`);

  if (problems.size) return { ok: false, problems: [...problems].slice(0, 6) };
  return { ok: true, eventsPerCycle: events / queried, peakLevel, msPerCycle };
}

function checkEvent(value: unknown, problems: Set<string>) {
  if (!value || typeof value !== "object") {
    problems.add("an event has no sound: every part needs s(...) or n(...)");
    return 0;
  }
  const v = foldValue(value as Record<string, unknown>, (n) => core.noteToMidi(n));
  const pitched = v.note !== undefined || v.n !== undefined;
  if (v.s === undefined && !pitched) {
    problems.add("an event has no sound: every part needs s(...) or n(...)");
    return 0;
  }
  const sound = v.s === undefined ? "triangle" : String(v.s).split(":")[0];
  const bank = v.bank === undefined ? undefined : String(v.bank);
  const machine = bank === undefined ? machineOf(sound) : undefined;
  if (machine) {
    if (!DRUM_MACHINES[machine.bank].sounds.includes(machine.sound)) problems.add(`the ${machine.bank} has no "${machine.sound}", only ${DRUM_MACHINES[machine.bank].sounds.join(", ")}`);
  } else if (bank === undefined) {
    if (!SOUNDS.has(sound)) problems.add(`"${sound}" is not in the sound bank`);
  } else if (!DRUM_MACHINES[bank]) problems.add(`"${bank}" is not one of the drum machines`);
  else if (!DRUM_MACHINES[bank].sounds.includes(sound)) problems.add(`the ${bank} has no "${sound}", only ${DRUM_MACHINES[bank].sounds.join(", ")}`);
  for (const [name, x] of Object.entries(v)) {
    const limit = LIMITS[name];
    if (!limit) continue;
    if (typeof x !== "number" || !Number.isFinite(x)) problems.add(`${name} must be a finite number, got ${String(x)}`);
    else if (x < limit[0] || x > limit[1]) problems.add(`${name} ${round(x)} is outside ${limit[0]} to ${limit[1]} (in "${sound}")`);
  }
  if (v.note !== undefined) {
    const midi = typeof v.note === "number" ? v.note : core.noteToMidi(String(v.note));
    if (!Number.isFinite(midi)) problems.add(`note ${String(v.note)} is not a note`);
  }
  const gain = typeof v.gain === "number" ? v.gain : 1;
  const velocity = typeof v.velocity === "number" ? v.velocity : 1;
  return Math.max(0, gain * velocity * levelOf(sound, bank));
}
