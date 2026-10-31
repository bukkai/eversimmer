import { timeAtCycle } from "../../shared/clock";
import { cleanName } from "../../shared/identity";
import type { Moment, ServerMessage } from "../../shared/protocol";
import type { Ingredient } from "../../shared/types";
import { addLine, focusChat, hideLines, showNotice, showPeople, showTalk, welcome } from "./chat";
import { hearDesk, setStatus, showConnection, showDesk, showTools } from "./desk";
import { $, remember, remembered } from "./dom";
import { getBroth, startEngine } from "./engine";
import { connect, send, serverNow, startClockAt } from "./net";
import { hearMusic, openConsole } from "./pot";
import { createPotView } from "./potview";
import { addEntry, followRecipe, setRecipe } from "./recipecard";

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
    showConnection(s);
    if (s === "connected") send({ t: "hello", name });
  });
  $("door").hidden = true;
  $("room").hidden = false;
  createPotView($<HTMLCanvasElement>("pot"), getBroth, () => ingredients, serverNow);
  focusChat();
  tick();
});

function onMessage(msg: ServerMessage) {
  hearMusic(msg);
  hearDesk(msg);
  switch (msg.t) {
    case "state":
      showTalk(msg.state.talk !== false);
      ingredients = msg.state.ingredients;
      setRecipe(msg.state.recipe);
      break;
    case "ingredients":
      ingredients = msg.ingredients;
      break;
    case "hide":
      hideLines(msg.ids);
      break;
    case "course":
      addEntry(msg.entry);
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
  }
}

async function playMoment(path: string) {
  const moment = (await (await fetch(`/@fs${path}`)).json()) as Moment;
  const { state } = moment;
  const from = Math.max(moment.cycle - 4, state.form[0]?.cycle ?? -Infinity);
  startClockAt(timeAtCycle(state.tempo, from));
  onMessage({ t: "state", state });
  showConnection(`moment ${moment.id}, frozen`);
  for (const [i, text] of [...moment.chat, `${moment.name} noted: ${moment.text}`].entries())
    addLine({ id: `moment-${i}`, at: moment.at, text });
  showDesk(true, false);
}

function tick() {
  showTools();
  followRecipe();
  requestAnimationFrame(tick);
}

openConsole(onMessage);
