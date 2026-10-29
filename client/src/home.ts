import { POTS_PATH, type Listing, type Listings } from "../../shared/protocol";
import { $ } from "./dom";

const list = $("pots");

function item(pot: Listing, live: boolean) {
  const li = document.createElement("li");
  li.className = live ? "live" : "soon";
  const row = document.createElement(live ? "a" : "div");
  if (live && pot.id) (row as HTMLAnchorElement).href = `/${encodeURIComponent(pot.id)}`;
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = pot.name;
  const line = document.createElement("span");
  line.className = "line";
  line.textContent = live ? pot.line : `${pot.line} Not on air yet.`.trim();
  row.append(name, line);
  li.append(row);
  return li;
}

fetch(POTS_PATH)
  .then((res) => res.json() as Promise<Listings>)
  .then((pots) => list.append(...pots.live.map((p) => item(p, true)), ...pots.soon.map((p) => item(p, false))))
  .catch(() => {
    const li = document.createElement("li");
    li.className = "away";
    li.textContent = "The pots can't be reached right now. Try again in a minute.";
    list.append(li);
  });
