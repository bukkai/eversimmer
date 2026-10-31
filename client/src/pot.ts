import type { Door, ServerMessage } from "../../shared/protocol";
import type { Course } from "../../shared/types";
import { doorPath, namePot } from "./address";
import {
  applyState,
  currentCycle,
  currentNote,
  loadCourse,
  setAir,
  setBroth,
  setForm,
  setKey,
  setMapPosition,
  setTempo,
  setTides,
  setTimeShift,
} from "./engine";
import { clockStats } from "./net";

let upcoming: Course | undefined;

export const upcomingCourse = () => upcoming;

export async function knock(): Promise<Door | undefined> {
  const data = document.getElementById("door-data");
  if (data?.textContent) return JSON.parse(data.textContent);
  try {
    const res = await fetch(doorPath());
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}

export function hearMusic(msg: ServerMessage) {
  switch (msg.t) {
    case "state":
      namePot(msg.state.name ?? "Potluck");
      applyState(msg.state);
      upcoming = msg.state.upcoming;
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
      break;
    case "broth":
      setBroth(msg.broth);
      break;
    case "tempo":
      setTempo(msg.tempo);
      break;
    case "course":
      upcoming = msg.course;
      loadCourse(msg.course);
      break;
    case "key":
      setKey(msg.key);
      break;
  }
}

export function openConsole(receive: (msg: ServerMessage) => void) {
  if (import.meta.env.DEV) Object.assign(window, { __pot: { currentCycle, currentNote, clockStats, receive } });
}
