import type { Door, ServerMessage } from "../../shared/protocol";
import { movePot, namePot, potId } from "./address";
import { applyVolume, hearDesk, setStatus, showConnection, showDesk, showTools } from "./desk";
import { $, remember, remembered } from "./dom";
import { leavePot, pauseEngine, resumeEngine, softenDrums, startEngine, warmUp } from "./engine";
import { addCourse, forgetCourses, setListening, setOnAir, showInstruments } from "./instruments";
import { connect, reconnect, send } from "./net";
import { hearMusic, knock, openConsole } from "./pot";
import { setSky, showSky } from "./sky";

void arrive();

async function arrive() {
  const door = await knock();
  softenDrums();
  if (door) namePot(door.name);
  showSky(door?.sky);
  showInstruments();
  if (door?.places) showPlaces(door.places);
  if (door?.devControls) openDesk();

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
    showConnection(s);
    lost = s !== "connected";
    if (started) show(sounding);
  }).then(warmUp);
  button.addEventListener("click", async () => {
    if (!started) {
      started = true;
      button.disabled = true;
      button.textContent = "Tuning in…";
      sounding = await startEngine({
        onError: (e) => {
          console.error(e);
          setStatus(String(e));
        },
        onBroken: (course, error) => send({ t: "broken", course, error }),
        onAudio: (running) => {
          sounding = running;
          show(sounding);
        },
      }, connected);
      button.disabled = false;
      applyVolume();
      playing = true;
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

function showPlaces(places: NonNullable<Door["places"]>) {
  const nav = $("listen-places");
  const here = potId() ?? places[0].id;
  const links = places.map(({ id, place }) => {
    const a = document.createElement("a");
    a.href = `/${encodeURIComponent(id)}`;
    a.textContent = place;
    if (id === here) a.setAttribute("aria-current", "page");
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (a.hasAttribute("aria-current")) return;
      links.forEach((l) => l.removeAttribute("aria-current"));
      a.setAttribute("aria-current", "page");
      $("listen-place").textContent = place;
      $("listen-conditions").textContent = "Listening for the weather…";
      movePot(id);
      leavePot();
      forgetCourses();
      reconnect();
    });
    return a;
  });
  nav.append(...links);
  nav.hidden = false;
}

function openDesk() {
  const toggle = $<HTMLButtonElement>("desk-toggle");
  const drawer = $("desk");
  let open = false;
  const show = (now: boolean) => {
    open = now;
    drawer.hidden = !open;
    toggle.textContent = open ? "Close" : "Desk";
    toggle.setAttribute("aria-expanded", String(open));
  };
  show(remembered("desk") === "open");
  toggle.addEventListener("click", () => {
    show(!open);
    remember("desk", open ? "open" : "closed");
  });
  toggle.hidden = false;
  showDesk(true);
  const tick = () => {
    if (open) showTools();
    requestAnimationFrame(tick);
  };
  tick();
}

function onMessage(msg: ServerMessage) {
  hearMusic(msg);
  hearDesk(msg);
  switch (msg.t) {
    case "state":
      setOnAir(msg.state.epoch);
      addCourse(msg.state.course);
      if (msg.state.upcoming) addCourse(msg.state.upcoming);
      break;
    case "course":
      addCourse(msg.course);
      break;
    case "sky":
      setSky(msg.sky);
      break;
    case "listening":
      setListening(msg.places);
      break;
    case "notice":
      setStatus(msg.text);
      break;
  }
}

openConsole(onMessage);
