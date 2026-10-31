import type { ServerMessage } from "../../shared/protocol";
import { $ } from "./dom";
import { currentCycle, currentNote, getCps, getScale, lookahead, secondsUntil, setVolume } from "./engine";
import { showLayers } from "./layerpanel";
import { clockStats } from "./net";
import { upcomingCourse } from "./pot";
import { offerCode, setStatus, showBroth, showDeskAt, showKey, showMap, showPretend } from "./tuning";

export { setStatus, showDesk } from "./tuning";

export function hearDesk(msg: ServerMessage) {
  switch (msg.t) {
    case "state":
      showBroth(msg.state.broth);
      showKey(msg.state.key);
      offerCode(msg.state.course.code);
      showMap(msg.state.map);
      break;
    case "map":
      showMap(msg.map);
      break;
    case "broth":
      showBroth(msg.broth);
      break;
    case "course":
      setStatus("");
      break;
    case "key":
      showKey(msg.key);
      break;
    case "sky":
      showPretend(msg.sky.pretend);
      break;
  }
}

export const showConnection = (status: string) => ($("conn").textContent = status);

export function showTools() {
  const cycle = currentCycle();
  $("clock").textContent = `cycle ${cycle.toFixed(2)}`;
  $("scale").textContent = getScale();
  $("cps").textContent = getCps().toFixed(3);
  $("course-note").textContent = currentNote();
  showDeskAt(cycle);
  showLayers();
  const { offset, rtt } = clockStats();
  const ahead = lookahead();
  $("sync").textContent =
    offset === undefined
      ? "syncing…"
      : `synced, round trip ${rtt.toFixed(0)} ms${ahead > 250 ? `, playing ${ahead.toFixed(0)} ms ahead` : ""}`;
  const upcoming = upcomingCourse();
  if (upcoming && upcoming.startedAtCycle > cycle) {
    const secs = secondsUntil(upcoming.startedAtCycle);
    $("upcoming").textContent = `next course at cycle ${upcoming.startedAtCycle} (in ${secs.toFixed(1)} s)`;
  } else $("upcoming").textContent = "";
}

const volume = $<HTMLInputElement>("volume");
const mute = $<HTMLButtonElement>("mute");
let muted = false;
export const applyVolume = () => {
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
