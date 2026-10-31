import { parse } from "acorn";

type Edit = { parts: string[]; remove: string[]; final: string };
type Spliced = { ok: true; code: string } | { ok: false; problems: string[] };

type Node = { type: string; start: number; end: number; [key: string]: any };

export function splice(current: string, edit: Edit): Spliced {
  const problems: string[] = [];
  const body = program(current)?.body;
  if (!body?.length || body.at(-1)!.type !== "ExpressionStatement")
    return { ok: false, problems: ["the course playing now does not end with a pattern"] };
  const statements = body.slice(0, -1);
  const declared = new Map<string, number>();
  statements.forEach((s, i) => names(s).forEach((n) => declared.set(n, i)));

  const removed = new Set<number>();
  for (const name of edit.remove) {
    const i = declared.get(name);
    if (i === undefined) problems.push(`remove names ${name}, which the course does not declare`);
    else removed.add(i);
  }

  const replaced = new Map<number, { text: string; decl: Node }>();
  const added: { text: string; decl: Node; own: string[] }[] = [];
  for (const source of edit.parts) {
    const text = source.trim();
    const part = program(text);
    const decl = part?.body.length === 1 ? part.body[0] : undefined;
    const own = decl ? names(decl) : [];
    if (!decl || !own.length) {
      problems.push(`a part is not a single declaration like const name = ...: ${text.slice(0, 60)}`);
      continue;
    }
    const i = own.map((n) => declared.get(n)).find((x) => x !== undefined);
    if (i === undefined) {
      if (added.some((a) => a.own.some((n) => own.includes(n)))) problems.push(`${own.join(", ")} is given twice`);
      added.push({ text, decl, own });
    } else {
      if (replaced.has(i)) problems.push(`${own.join(", ")} is given twice`);
      if (removed.has(i)) problems.push(`${own.join(", ")} is both removed and given as a part`);
      replaced.set(i, { text, decl });
    }
  }

  const final = program(edit.final.trim());
  if (final?.body.length !== 1 || final.body[0].type !== "ExpressionStatement")
    problems.push("final is not a single pattern expression, like stack(...)");
  if (problems.length) return { ok: false, problems };

  const uses = statements.map((s, i) => identifiers(replaced.get(i)?.decl ?? s));
  const after = new Map<number, string[]>();
  const anchorOf = new Map<string, number>();
  for (const a of added) {
    let anchor = -1;
    for (const id of identifiers(a.decl))
      if (!a.own.includes(id)) anchor = Math.max(anchor, declared.get(id) ?? -1, anchorOf.get(id) ?? -1);
    if (anchor === -1) {
      const first = uses.findIndex((ids, i) => !removed.has(i) && a.own.some((n) => ids.has(n)));
      anchor = first === -1 ? statements.length - 1 : first - 1;
    }
    a.own.forEach((n) => anchorOf.set(n, anchor));
    after.set(anchor, [...(after.get(anchor) ?? []), a.text]);
  }
  const insert = (anchor: number) => (after.get(anchor) ?? []).map((p) => `${p}\n\n`).join("");

  let code = "";
  let at = 0;
  statements.forEach((s, i) => {
    const block = blockStart(current, s.start);
    code += current.slice(at, block) + insert(i - 1);
    const part = replaced.get(i)?.text;
    if (removed.has(i)) code = code.replace(/\s+$/, "");
    else if (part === undefined) code += current.slice(block, s.end);
    else code += (part.startsWith("//") ? "" : current.slice(block, s.start)) + part;
    at = s.end;
  });
  const last = body.at(-1)!;
  code += current.slice(at, blockStart(current, last.start)) + insert(statements.length - 1);
  code += current.slice(blockStart(current, last.start), last.start) + edit.final.trim() + current.slice(last.end);
  return { ok: true, code };
}

function blockStart(code: string, start: number) {
  let at = code.lastIndexOf("\n", start - 1) + 1;
  while (at > 0) {
    const prev = code.lastIndexOf("\n", at - 2) + 1;
    if (!code.slice(prev, at - 1).trim().startsWith("//")) break;
    at = prev;
  }
  return at;
}

function program(code: string): { body: Node[] } | undefined {
  try {
    return parse(code, { ecmaVersion: "latest", sourceType: "script" }) as unknown as { body: Node[] };
  } catch {
    return undefined;
  }
}

function names(s: Node): string[] {
  if (s.type !== "VariableDeclaration") return [];
  return s.declarations.flatMap((d: Node) => (d.id.type === "Identifier" ? [d.id.name] : []));
}

function identifiers(node: Node, found = new Set<string>()) {
  if (node.type === "Identifier") found.add(node.name);
  for (const v of Object.values(node))
    for (const child of Array.isArray(v) ? v : [v])
      if (child && typeof child === "object" && typeof child.type === "string") identifiers(child, found);
  return found;
}

type Difference = { parts: string[]; remove: string[]; final: string };

export function difference(base: string, code: string): Difference | undefined {
  const from = blocks(base);
  const to = blocks(code);
  if (!from || !to) return undefined;
  const before = new Map(from.statements.flatMap((b) => b.names.map((n) => [n, b.text] as const)));
  const kept = new Set(to.statements.flatMap((b) => b.names));
  return {
    parts: to.statements.filter((b) => b.names.some((n) => before.get(n) !== b.text)).map((b) => b.text),
    remove: [...before.keys()].filter((n) => !kept.has(n)),
    final: to.final,
  };
}

function blocks(code: string) {
  const body = program(code)?.body;
  if (!body?.length || body.at(-1)!.type !== "ExpressionStatement") return undefined;
  const statements = body.slice(0, -1).map((s) => ({ names: names(s), text: code.slice(blockStart(code, s.start), s.end) }));
  if (statements.some((s) => !s.names.length)) return undefined;
  const last = body.at(-1)!;
  return { statements, final: code.slice(last.start, last.end) };
}
