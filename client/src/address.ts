import { DOOR_PATH, WS_PATH } from "../../shared/protocol";
import { $ } from "./dom";

let id = location.pathname.split("/")[1] || undefined;
let name = id ? id[0].toUpperCase() + id.slice(1) : "Potluck";

const referrer = (() => {
  try {
    const host = new URL(document.referrer).hostname;
    return host && host !== location.hostname ? `?from=${encodeURIComponent(host)}` : "";
  } catch {
    return "";
  }
})();

export const wsPath = () => (id ? `${WS_PATH}/${encodeURIComponent(id)}` : WS_PATH) + referrer;
export const doorPath = () => (id ? `${DOOR_PATH}/${encodeURIComponent(id)}` : DOOR_PATH);
export const potId = () => id;

export function movePot(to: string) {
  id = to;
  history.replaceState(null, "", `/${encodeURIComponent(to)}`);
}
export const potName = () => name;

export function namePot(n: string) {
  name = n;
  document.title = `Eversimmer FM · ${n}`;
  $("pot-name").textContent = n;
  $("chat-name").textContent = n;
  $("listen-station").textContent = `Eversimmer FM · ${n}`;
}

namePot(name);
