import { POTS_PATH, type Listing, type Listings } from "../../shared/protocol";
import { $ } from "./dom";

const list = $("pots");
const REFRESH_MS = 30_000;

function onAir(since: number, at = Date.now()) {
  const minutes = Math.max(0, Math.floor((at - since) / 60_000));
  const [n, unit] = minutes >= 2 * 1440 ? [Math.floor(minutes / 1440), "day"] : minutes >= 120 ? [Math.floor(minutes / 60), "hour"] : [minutes, "minute"];
  return `on air for ${n} ${unit}${n === 1 ? "" : "s"}`;
}

function stats(pot: Listing) {
  const parts = [];
  if (pot.listening !== undefined) parts.push(`${pot.listening} listening`);
  if (pot.since !== undefined) parts.push(onAir(pot.since));
  return parts.join(" · ");
}

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
  if (live) {
    const now = document.createElement("span");
    now.className = "stats mono";
    now.textContent = stats(pot);
    row.append(now);
  }
  li.append(row);
  return li;
}

const listings = () => fetch(POTS_PATH, { cache: "no-store" }).then((res) => res.json() as Promise<Listings>);

listings()
  .then((pots) => {
    list.append(...pots.live.map((p) => item(p, true)), ...pots.soon.map((p) => item(p, false)));
    setInterval(() => {
      listings()
        .then(({ live }) => live.forEach((pot, i) => {
          const now = list.querySelectorAll<HTMLElement>(".live .stats")[i];
          if (now) now.textContent = stats(pot);
        }))
        .catch(() => {});
    }, REFRESH_MS);
  })
  .catch(() => {
    const li = document.createElement("li");
    li.className = "away";
    li.textContent = "The pots can't be reached right now. Try again in a minute.";
    list.append(li);
  });
