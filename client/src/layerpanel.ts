import { $ } from "./dom";
import { currentLayers } from "./engine";
import { heardWithin, isMuted, solo, toggle, unmuteAll } from "./layers";

const layerList = $("layers");
let shownLayers = "";
$("layers-all").addEventListener("click", unmuteAll);

export function showLayers() {
  const layers = currentLayers();
  const names = layers.map((l) => l.name);
  if (names.join() !== shownLayers) {
    shownLayers = names.join();
    layerList.replaceChildren(
      ...layers.map((layer) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.textContent = layer.name;
        button.title = layer.about;
        button.dataset.layer = layer.name;
        button.addEventListener("click", (e) => (e.shiftKey ? solo(layer.name, names) : toggle(layer.name)));
        li.append(button);
        return li;
      }),
    );
  }
  for (const button of layerList.querySelectorAll<HTMLButtonElement>("button")) {
    const name = button.dataset.layer!;
    button.classList.toggle("muted", isMuted(name));
    button.classList.toggle("heard", heardWithin(name, 2000));
  }
}
