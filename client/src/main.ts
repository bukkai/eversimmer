import { timeAtCycle } from "../../shared/clock";
import { cleanName } from "../../shared/identity";
import type { Door, Moment, ServerMessage } from "../../shared/protocol";
import type { Course, Ingredient } from "../../shared/types";
import { doorPath, namePot } from "./address";
import { addLine, focusChat, hideLines, showNotice, showPeople, showTalk, welcome } from "./chat";
import { $, remember, remembered } from "./dom";
import {
  applyState,
  currentCycle,
  currentNote,
  getBroth,
  getCps,
  getScale,
  loadCourse,
  lookahead,
  pauseEngine,
  resumeEngine,
  secondsUntil,
  setBroth,
  setForm,
  setKey,
  setMapPosition,
  setTempo,
  setTimeShift,
  setTides,
  setAir,
  setVolume,
  startEngine,
  warmUp,
} from "./engine";
import { showLayers } from "./layerpanel";
import { clockStats, connect, send, serverNow, startClockAt } from "./net";
import { createPotView } from "./potview";
import { setSky, showSky } from "./sky";
import { addEntry, followRecipe, setRecipe } from "./recipecard";
import { offerCode, setStatus, showBroth, showDesk, showDeskAt, showKey, showMap } from "./tuning";

let upcoming: Course | undefined;
let ingredients: Ingredient[] = [];

const nameInput = $<HTMLInputElement>("name");
nameInput.value = remembered("name") ?? "";

$("join-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = cleanName(nameInput.value);
  if (!name) return;
  remember("name", name);
  ($("join") as HTMLButtonElement).disabled = true;
  await startEngine({ onError: setStatus, onBroken: (course, error) => send({ t: "broken", course, error }) });
  if (import.meta.env.VITE_MOMENT) await playMoment(import.meta.env.VITE_MOMENT);
  else await connect(onMessage, (s) => {
    $("conn").textContent = s;
    if (s === "connected") send({ t: "hello", name });
  });
  $("door").hidden = true;
  $("room").hidden = false;
  createPotView($<HTMLCanvasElement>("pot"), getBroth, () => ingredients, serverNow);
  focusChat();
  tick();
});

if (!import.meta.env.VITE_MOMENT) void openDoor();

async function knock(): Promise<Door | undefined> {
  const data = document.getElementById("door-data");
  if (data?.textContent) return JSON.parse(data.textContent);
  try {
    const res = await fetch(doorPath);
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}

async function openDoor() {
  const door = await knock();
  if (!door?.sky || door.devControls) return;
  namePot(door.name);
  $("door").hidden = true;
  $("listen").hidden = false;
  showSky(door.sky);

  const button = $<HTMLButtonElement>("listen-button");
  const note = $("listen-note");
  const phone = matchMedia("(pointer: coarse)").matches;
  let started = false;
  let playing = false;
  let lost = false;
  const show = (sounding: boolean) => {
    button.textContent = !playing ? "Tap to listen" : sounding ? "Listening · tap to pause" : "Tap to listen again";
    button.classList.toggle("on", playing && sounding);
    note.textContent =
      playing && !sounding
        ? "The music stopped while you were away."
        : lost && playing
          ? "Lost the weather for a moment. The music plays on."
          : playing && phone
            ? "Keep this page open: a phone stops the music when it locks or you switch apps."
            : "";
  };
  let sounding = false;
  const connected = connect(onMessage, (s) => {
    lost = s !== "connected";
    if (started) show(sounding);
  }).then(warmUp);
  button.addEventListener("click", async () => {
    if (!started) {
      started = true;
      button.disabled = true;
      button.textContent = "Tuning in…";
      await startEngine({
        onError: (e) => console.error(e),
        onBroken: (course, error) => send({ t: "broken", course, error }),
        onAudio: (running) => {
          sounding = running;
          show(sounding);
        },
      }, connected);
      button.disabled = false;
      setVolume(Number(volume.value));
      playing = true;
      sounding = true;
    } else if (playing && sounding) {
      playing = false;
      await pauseEngine();
    } else {
      playing = true;
      sounding = await resumeEngine();
    }
    show(sounding);
  });
}

function onMessage(msg: ServerMessage) {
  switch (msg.t) {
    case "state":
      namePot(msg.state.name ?? "Potluck");
      showTalk(msg.state.talk !== false);
      applyState(msg.state);
      showBroth(msg.state.broth);
      showKey(msg.state.key);
      offerCode(msg.state.course.code);
      upcoming = msg.state.upcoming;
      ingredients = msg.state.ingredients;
      setRecipe(msg.state.recipe);
      showMap(msg.state.map);
      break;
    case "form":
      setForm(msg.form);
      break;
    case "timeShift":
      setTimeShift(msg.ms);
      break;
    case "tides":
      setTides(msg.tides);
      break;
    case "air":
      setAir(msg.air);
      break;
    case "map":
      setMapPosition(msg.map.position);
      showMap(msg.map);
      break;
    case "ingredients":
      ingredients = msg.ingredients;
      break;
    case "hide":
      hideLines(msg.ids);
      break;
    case "broth":
      setBroth(msg.broth);
      showBroth(msg.broth);
      break;
    case "tempo":
      setTempo(msg.tempo);
      break;
    case "course":
      upcoming = msg.course;
      loadCourse(msg.course);
      addEntry(msg.entry);
      setStatus("");
      break;
    case "key":
      setKey(msg.key);
      showKey(msg.key);
      break;
    case "welcome":
      showDesk(msg.devControls);
      welcome(msg.you, msg.history);
      break;
    case "presence":
      showPeople(msg.people);
      break;
    case "chat":
      addLine(msg.line);
      break;
    case "notice":
      showNotice(msg.text);
      break;
    case "sky":
      setSky(msg.sky);
      break;
  }
}

async function playMoment(path: string) {
  const moment = (await (await fetch(`/@fs${path}`)).json()) as Moment;
  const { state } = moment;
  const from = Math.max(moment.cycle - 4, state.form[0]?.cycle ?? -Infinity);
  startClockAt(timeAtCycle(state.tempo, from));
  onMessage({ t: "state", state });
  $("conn").textContent = `moment ${moment.id}, frozen`;
  for (const [i, text] of [...moment.chat, `${moment.name} noted: ${moment.text}`].entries())
    addLine({ id: `moment-${i}`, at: moment.at, text });
  showDesk(true, false);
}

const volume = $<HTMLInputElement>("volume");
const mute = $<HTMLButtonElement>("mute");
let muted = false;
const applyVolume = () => {
  setVolume(muted ? 0 : Number(volume.value));
  mute.textContent = muted ? "🔇" : "🔊";
};
volume.addEventListener("input", () => {
  muted = false;
  applyVolume();
});
mute.addEventListener("click", () => {
  muted = !muted;
  applyVolume();
});

function tick() {
  const cycle = currentCycle();
  $("clock").textContent = `cycle ${cycle.toFixed(2)}`;
  $("scale").textContent = getScale();
  $("cps").textContent = getCps().toFixed(3);
  $("course-note").textContent = currentNote();
  showDeskAt(cycle);
  followRecipe();
  showLayers();
  const { offset, rtt } = clockStats();
  const ahead = lookahead();
  $("sync").textContent =
    offset === undefined
      ? "syncing…"
      : `synced, round trip ${rtt.toFixed(0)} ms${ahead > 250 ? `, playing ${ahead.toFixed(0)} ms ahead` : ""}`;
  if (upcoming && upcoming.startedAtCycle > cycle) {
    const secs = secondsUntil(upcoming.startedAtCycle);
    $("upcoming").textContent = `next course at cycle ${upcoming.startedAtCycle} (in ${secs.toFixed(1)} s)`;
  } else $("upcoming").textContent = "";
  requestAnimationFrame(tick);
}

if (import.meta.env.DEV) Object.assign(window, { __pot: { currentCycle, currentNote, clockStats, receive: onMessage } });
