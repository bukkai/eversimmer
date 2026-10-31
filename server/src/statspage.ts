import { type Day, STAYS } from "./stats";

const esc = (text: string | number) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function bars(record: Record<string, number>, top = 10) {
  const rows = Object.entries(record).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, top);
  if (!rows.length) return `<p class="muted">none</p>`;
  const most = rows[0][1];
  return `<table class="bars">${rows
    .map(([k, n]) => `<tr><td>${esc(k)}</td><td class="bar"><i style="width:${(n / most) * 100}%"></i></td><td class="n">${n}</td></tr>`)
    .join("")}</table>`;
}

function tile(label: string, value: string | number) {
  return `<div class="tile"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div></div>`;
}

function hours(byHour: number[]) {
  const most = Math.max(1, ...byHour);
  const cols = byHour
    .map((n, h) => `<div class="col" title="${String(h).padStart(2, "0")}h UTC: ${n}"><i style="height:${(n / most) * 100}%"></i><span>${h % 6 ? "" : h}</span></div>`)
    .join("");
  return `<div class="hours">${cols}</div>`;
}

function dayInFull(d: Day) {
  const pots = Object.entries(d.pots).sort((a, b) => b[1].visits - a[1].visits);
  const potRows = pots.length
    ? `<table class="list"><tr><th>pot</th><th>places</th><th>visits</th><th>peak</th></tr>${pots
        .map(([p, v]) => `<tr><td>${esc(p)}</td><td>${v.places}</td><td>${v.visits}</td><td>${v.peak}</td></tr>`)
        .join("")}</table>`
    : `<p class="muted">none</p>`;
  return `<section class="day">
  <h2>${esc(d.day)}</h2>
  <div class="tiles">${tile("places", d.places)}${tile("visits", d.visits)}${tile("hours", d.hours.toFixed(1))}${tile("peak", d.peak)}</div>
  <h3>At once, by UTC hour</h3>${hours(d.byHour)}
  <div class="grid">
    <div><h3>Pots</h3>${potRows}</div>
    <div><h3>Stays</h3>${bars(Object.fromEntries(STAYS.map((s) => [s, d.stays[s]])), STAYS.length)}</div>
    <div><h3>From</h3>${bars(d.from)}</div>
    <div><h3>Languages</h3>${bars(d.languages)}</div>
    <div><h3>Devices</h3>${bars({ mobile: d.devices.mobile, desktop: d.devices.desktop })}</div>
    <div><h3>Moves</h3>${bars(d.moves)}</div>
  </div>
</section>`;
}

export function statsPage(days: Day[], detail: number, key: string) {
  const link = (n: number, label: string) => {
    const q = new URLSearchParams({ ...(key ? { key } : {}), days: String(n) });
    return n === detail ? `<b>${label}</b>` : `<a href="?${esc(q.toString())}">${label}</a>`;
  };
  const most = Math.max(1, ...days.map((d) => d.places));
  const rows = [...days]
    .reverse()
    .map(
      (d) =>
        `<tr><td>${esc(d.day)}</td><td class="bar"><i style="width:${(d.places / most) * 100}%"></i></td><td class="n">${d.places}</td><td class="n">${d.visits}</td><td class="n">${d.hours.toFixed(1)}</td><td class="n">${d.peak}</td></tr>`,
    )
    .join("");
  const body = days.length
    ? `<section><h2>Every day</h2><table class="bars days"><tr><th>day</th><th></th><th class="n">places</th><th class="n">visits</th><th class="n">hours</th><th class="n">peak</th></tr>${rows}</table></section>
${days.slice(-detail).reverse().map(dayInFull).join("\n")}`
    : `<p class="muted">No days counted yet.</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Eversimmer stats</title>
<style>
:root { --bg: #f4efe6; --panel: #fbf8f2; --ink: #2b241c; --muted: #8a7d6c; --accent: #b5562c; --line: #e2d9ca; color-scheme: light dark }
@media (prefers-color-scheme: dark) { :root { --bg: #17130f; --panel: #201b16; --ink: #eee5d8; --muted: #9a8c7a; --accent: #e07a48; --line: #342c24 } }
* { box-sizing: border-box }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 ui-serif, Georgia, serif }
main { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px }
h1 { font-weight: normal; margin: 0 0 4px }
h2 { font-weight: normal; margin: 32px 0 12px; border-bottom: 1px solid var(--line); padding-bottom: 4px }
h3 { font: 12px ui-monospace, Menlo, monospace; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin: 20px 0 8px }
.muted, nav { color: var(--muted) }
nav { font: 13px ui-monospace, Menlo, monospace }
nav a { color: var(--accent) }
table { border-collapse: collapse; width: 100%; font: 13px ui-monospace, Menlo, monospace }
th { text-align: left; color: var(--muted); font-weight: normal }
td, th { padding: 3px 6px 3px 0; white-space: nowrap }
.n { text-align: right; width: 1%; padding-left: 8px }
.bar { width: 60%; padding-left: 8px }
.bar i { display: block; height: 10px; min-width: 1px; background: var(--accent); border-radius: 2px; opacity: .8 }
.bars td:first-child { overflow: hidden; text-overflow: ellipsis; max-width: 180px }
.days .bar { width: 50% }
.list td:not(:first-child), .list th:not(:first-child) { text-align: right }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px }
.tile { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px }
.tile .value { font-size: 26px }
.tile .label { font: 12px ui-monospace, Menlo, monospace; color: var(--muted) }
.hours { display: flex; gap: 2px; height: 80px; align-items: flex-end }
.col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; position: relative }
.col i { display: block; background: var(--accent); opacity: .8; border-radius: 2px 2px 0 0; min-height: 1px }
.col span { position: absolute; bottom: -18px; font: 11px ui-monospace, Menlo, monospace; color: var(--muted) }
.day .hours { margin-bottom: 24px }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0 24px }
@media (max-width: 520px) { .tiles { grid-template-columns: repeat(2, 1fr) } .days .bar { width: 30% } }
</style>
</head>
<body>
<main>
<h1>Eversimmer FM listening</h1>
<nav>by UTC day · in full: ${link(1, "today")} · ${link(7, "7 days")} · ${link(30, "30 days")}</nav>
${body}
</main>
</body>
</html>
`;
}
