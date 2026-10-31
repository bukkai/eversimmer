import { round } from "../../shared/numbers";
import { scaleFor, type BrothKey, type RecipeEntry } from "../../shared/types";
import { potName } from "./address";
import { currentStone } from "./engine";

export function renderRecipe(list: HTMLOListElement, entries: RecipeEntry[], playing: string | undefined, onShare: (e: RecipeEntry) => void) {
  list.replaceChildren(
    ...[...entries].reverse().map((entry) => {
      const li = document.createElement("li");
      if (entry.id === playing) li.className = "now";
      const time = document.createElement("time");
      time.dateTime = new Date(entry.at).toISOString();
      time.textContent = clock(entry.at);
      const note = document.createElement("span");
      note.className = "note";
      note.textContent = entry.note || "a new course";
      const open = document.createElement("a");
      open.href = strudelLink(entry, potName());
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = "open in Strudel";
      const share = document.createElement("button");
      share.className = "ghost small";
      share.textContent = "Share";
      share.addEventListener("click", () => onShare(entry));
      const actions = document.createElement("span");
      actions.className = "actions";
      actions.append(open, share);
      li.append(time, note, actions);
      return li;
    }),
  );
}

export const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function standalone(entry: RecipeEntry, pot: string) {
  const b = entry.broth;
  const signals = (Object.keys(b) as BrothKey[]).map((k) => `  ${k}: pure(${round(b[k])}),`).join("\n");
  return [
    `// ${entry.note || "a new course"}`,
    `// Eversimmer FM · ${pot}, ${new Date(entry.at).toLocaleString()}`,
    `// the broth as it was then; change the numbers to hear the room move`,
    `samples('github:tidalcycles/dirt-samples')`,
    `samples('https://raw.githubusercontent.com/felixroos/dough-samples/main/piano.json')`,
    `setcps(${round(entry.cps)})`,
    `const broth = {`,
    signals,
    `  scale: "${scaleFor(entry.key, b.valence)}",`,
    `}`,
    ``,
    entry.code === currentStone() ? `// the stone\n${entry.code}` : entry.code,
  ].join("\n");
}

export function strudelLink(entry: RecipeEntry, pot: string) {
  const bytes = new TextEncoder().encode(standalone(entry, pot));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `https://strudel.cc/#${encodeURIComponent(btoa(binary))}`;
}
