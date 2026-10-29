import type { Person } from "../../shared/identity";
import type { ChatLine } from "../../shared/protocol";
import { $ } from "./dom";
import { send } from "./net";

const MAX_LINES = 200;

const lines = $<HTMLOListElement>("lines");
const textInput = $<HTMLInputElement>("text");
let me: Person | undefined;

$("say").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text) return;
  send({ t: "say", text });
  textInput.value = "";
});

export function welcome(you: Person, history: ChatLine[]) {
  me = you;
  lines.replaceChildren();
  history.forEach((line) => addLine(line));
}

export function showTalk(talk: boolean) {
  lines.hidden = !talk;
  $("say").hidden = !talk;
}

export const focusChat = () => textInput.focus();

export function addLine(line: ChatLine) {
  const atBottom = lines.scrollHeight - lines.scrollTop - lines.clientHeight < 40;
  const li = document.createElement("li");
  li.dataset.id = line.id;
  if (!line.person) {
    li.className = "system";
    li.textContent = line.text;
    lines.append(li);
    if (atBottom) lines.scrollTop = lines.scrollHeight;
    return;
  }
  if (line.person.id === me?.id) li.className = "mine";
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = line.person.color;
  const name = document.createElement("strong");
  name.textContent = line.person.name;
  name.style.color = line.person.color;
  const text = document.createElement("span");
  text.textContent = line.text;
  li.append(dot, name, text);
  lines.append(li);
  while (lines.children.length > MAX_LINES) lines.firstElementChild!.remove();
  if (atBottom) lines.scrollTop = lines.scrollHeight;
}

export function hideLines(ids: string[]) {
  for (const id of ids) lines.querySelector(`li[data-id="${CSS.escape(id)}"]`)?.remove();
}

export function showPeople(people: Person[]) {
  $("people").replaceChildren(
    ...people.map((p) => {
      const li = document.createElement("li");
      li.textContent = p.name;
      li.style.setProperty("--c", p.color);
      return li;
    }),
  );
}

let noticeTimer: ReturnType<typeof setTimeout> | undefined;
export function showNotice(text: string) {
  $("notice").textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($("notice").textContent = ""), 4000);
}
