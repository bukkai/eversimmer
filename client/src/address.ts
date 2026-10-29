import { DOOR_PATH, WS_PATH } from "../../shared/protocol";
import { $ } from "./dom";

const id = location.pathname.split("/")[1] || undefined;
let name = id ? id[0].toUpperCase() + id.slice(1) : "Potluck";

export const wsPath = id ? `${WS_PATH}/${encodeURIComponent(id)}` : WS_PATH;
export const doorPath = id ? `${DOOR_PATH}/${encodeURIComponent(id)}` : DOOR_PATH;
export const potName = () => name;

export function namePot(n: string) {
  name = n;
  document.title = `Eversimmer FM · ${n}`;
  $("pot-name").textContent = n;
  $("chat-name").textContent = n;
}

namePot(name);
