import { blockInfo, FILLS, nextTrack, paletteAt, sectionAt, type Section } from "../../shared/form";
import { AXES, REGIONS, type MapAxis } from "../../shared/map";
import { describePalette, describeStyle, styleWeights, tidesAt } from "../../shared/palette";
import { BROTH_KEYS, BROTH_RANGES, RESTING_BROTH, type Broth, type BrothKey, type PotMap } from "../../shared/types";
import { $ } from "./dom";
import { currentCycle, currentStone, getForm, getKey, getTimeShift, secondsUntil, wallNow } from "./engine";
import { send } from "./net";

const code = $<HTMLTextAreaElement>("code");
const status = $("status");
const keySelect = $<HTMLSelectElement>("key");

export function showDesk(on: boolean, notes = on) {
  $("tuning").hidden = !on;
  $("layers-panel").hidden = !on;
  $("feedback").hidden = !notes;
}

export const setStatus = (text: string) => (status.textContent = text);

export const offerCode = (course: string) => (code.value ||= course);

export const showKey = (key: string) => (keySelect.value = key);

const inputs = {} as Record<BrothKey, HTMLInputElement>;
const outputs = {} as Record<BrothKey, HTMLOutputElement>;
for (const key of BROTH_KEYS) {
  const [min, max] = BROTH_RANGES[key];
  const row = document.createElement("label");
  row.className = "slider";
  row.innerHTML = `<span>${key}</span><input type="range" min="${min}" max="${max}"
    step="${key === "voices" ? 1 : 0.01}"><output class="mono"></output>`;
  const input = row.querySelector("input")!;
  inputs[key] = input;
  outputs[key] = row.querySelector("output")!;
  if (key === "voices") {
    input.disabled = true;
    row.title = "People in the room";
  } else {
    input.addEventListener("input", () => {
      outputs[key].textContent = format(key, Number(input.value));
      send({ t: "dev:broth", patch: { [key]: Number(input.value) } });
    });
  }
  $("sliders").append(row);
}
showBroth(RESTING_BROTH);

export function showBroth(broth: Broth) {
  for (const key of BROTH_KEYS) {
    if (document.activeElement !== inputs[key]) inputs[key].value = String(broth[key]);
    outputs[key].textContent = format(key, broth[key]);
  }
}

function format(key: BrothKey, v: number) {
  return key === "voices" ? String(v) : v.toFixed(2);
}

const mapInputs = {} as Record<MapAxis, HTMLInputElement>;
for (const axis of AXES) {
  const row = document.createElement("label");
  row.className = "slider";
  row.innerHTML = `<span>${axis}</span><input type="range" min="0" max="1" step="0.01"><output class="mono"></output>`;
  const input = row.querySelector("input")!;
  mapInputs[axis] = input;
  input.addEventListener("input", () => {
    row.querySelector("output")!.textContent = Number(input.value).toFixed(2);
    send({ t: "dev:map", patch: { [axis]: Number(input.value) } });
  });
  $("map-sliders").append(row);
}

export function showMap(map: PotMap) {
  const share = Math.round(map.share * 100);
  $("map-where").textContent = `${map.region} ${share}% · ${map.towards} ${100 - share}%`;
  for (const axis of AXES) {
    const input = mapInputs[axis];
    if (document.activeElement !== input) input.value = String(map.position[axis]);
    input.parentElement!.querySelector("output")!.textContent = map.position[axis].toFixed(2);
  }
}

$("rest").addEventListener("click", () => {
  send({ t: "dev:rest" });
  jump.value = "";
  jumpNow.disabled = true;
});
$("next-track").addEventListener("click", () => send({ t: "dev:next" }));
const jump = $<HTMLSelectElement>("jump");
const jumpNow = $<HTMLButtonElement>("jump-now");
for (const r of [...REGIONS].sort((a, b) => a.bpm - b.bpm)) jump.append(new Option(r.name, r.id));
jump.addEventListener("change", () => {
  jumpNow.disabled = !jump.value;
  if (jump.value) send({ t: "dev:genre", region: jump.value, now: false });
});
jumpNow.addEventListener("click", () => {
  if (jump.value) send({ t: "dev:genre", region: jump.value, now: true });
});
$("travel").addEventListener("change", (e) =>
  send({ t: "dev:travel", ms: Number((e.target as HTMLSelectElement).value) * 3_600_000 }),
);
keySelect.addEventListener("change", () => send({ t: "dev:key", key: keySelect.value }));

$("play-code").addEventListener("click", () =>
  send({ t: "dev:course", code: code.value, note: "from the course editor" }),
);
$("play-stone").addEventListener("click", () =>
  send({ t: "dev:course", code: currentStone(), note: "back to the stone" }),
);
$("cook").addEventListener("click", () => {
  send({ t: "dev:cook" });
  setStatus("asked the live coder for a new course…");
});

const feedback = $<HTMLInputElement>("feedback-text");
let feedbackCycle: number | undefined;
feedback.addEventListener("input", () => {
  if (!feedback.value) feedbackCycle = undefined;
  else feedbackCycle ??= currentCycle();
});
$("feedback").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = feedback.value.trim();
  if (!text) return;
  send({ t: "dev:feedback", text, cycle: feedbackCycle ?? currentCycle() });
  feedback.value = "";
  feedbackCycle = undefined;
});

export function showDeskAt(cycle: number) {
  showForm(cycle);
  if (document.activeElement !== keySelect) keySelect.value = getKey();
}

function describeNextTrack(form: Section[], cycle: number) {
  const last = form[form.length - 1];
  const start = nextTrack(form, cycle)?.cycle ?? (last && last.cycle + last.length);
  if (start === undefined) return "no plan";
  if (start <= cycle) return `the plan ran out ${Math.floor(cycle - start)} bars ago: is the pot server still running?`;
  const before = sectionAt(form, start - 1);
  const seam = before?.kind === "build" ? "on a drop" : before?.seam === "mix" ? "mixed in" : "after a silence";
  const s = Math.max(0, Math.round(secondsUntil(start)));
  const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const out = form.find((x) => x.cycle > cycle && x.cycle < start && (x.kind === "outro" || x.kind === "breakdown"));
  const ending = out ? `, the ${out.kind} in ${Math.ceil(out.cycle - cycle)} bars` : "";
  return `next track in ${Math.ceil(start - cycle)} bars (${time}), ${seam}${ending}`;
}

function showForm(cycle: number) {
  const form = getForm();
  const now = sectionAt([...form], cycle);
  const next = form.find((s) => s.cycle > cycle);
  const block = blockInfo([...form], cycle);
  const where = now
    ? `${now.kind}${now.seam ? ` (${now.seam})` : ""}${block ? ` block ${block.index + 1}/${block.count}` : ""}${now.drop && cycle < now.cycle + 8 ? " (drop)" : ""} · depth ${now.depth.toFixed(2)}`
    : "no plan";
  $("form-where").textContent = next
    ? `${where} · ${next.drop ? "drop" : next.opens ? `next track (${next.kind})` : next.kind} in ${Math.ceil(next.cycle - cycle)} bars`
    : where;
  $("track-next").textContent = describeNextTrack([...form], cycle);
  const tides = tidesAt(wallNow());
  const travelled = getTimeShift() / 3_600_000;
  const travel = $<HTMLSelectElement>("travel");
  if (document.activeElement !== travel) travel.value = String(Math.round(travelled));
  $("palette-where").textContent =
    `${now ? describePalette(paletteAt([...form], cycle)) : ""}` +
    (block ? `${block.block.hats ? "" : ", no hats"}${block.block.pad ? "" : ", no pad"}${block.block.bass ? ", busier bass" : ""}${block.block.theme ? ", the theme" : ""}, ends with ${FILLS[block.block.fill]}` : "") +
    ` · style ${describeStyle(styleWeights(tides))} · day tide ${tides.day.toFixed(2)}, season ${tides.season.toFixed(2)}` +
    (travelled ? ` (travelled ${Math.round(travelled)} h ahead)` : "");
}
