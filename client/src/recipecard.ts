import { RECIPE_LENGTH } from "../../shared/protocol";
import type { RecipeEntry } from "../../shared/types";
import { potName } from "./address";
import { showNotice } from "./chat";
import { $, remember, remembered } from "./dom";
import { currentCourse } from "./engine";
import { clock, renderRecipe, strudelLink } from "./recipe";

const card = $<HTMLDetailsElement>("recipe-card");
card.open = remembered("recipe") === "open";
card.addEventListener("toggle", () => remember("recipe", card.open ? "open" : "closed"));

let recipe: RecipeEntry[] = [];
let shownPlaying: string | undefined;

export function setRecipe(entries: RecipeEntry[]) {
  recipe = entries;
  showRecipe();
}

export function addEntry(entry: RecipeEntry) {
  recipe = [...recipe.filter((e) => e.id !== entry.id), entry].slice(-RECIPE_LENGTH);
  showRecipe();
}

export function followRecipe() {
  if (currentCourse() !== shownPlaying) showRecipe();
}

function showRecipe() {
  shownPlaying = currentCourse();
  $("recipe-count").textContent = `${recipe.length} ${recipe.length === 1 ? "course" : "courses"}`;
  renderRecipe($<HTMLOListElement>("recipe"), recipe, shownPlaying, shareCourse);
}

async function shareCourse(entry: RecipeEntry) {
  const url = strudelLink(entry, potName());
  const text = `${clock(entry.at)} · ${entry.note || "a new course"}, from Eversimmer FM · ${potName()}`;
  try {
    if (navigator.share) await navigator.share({ title: `Eversimmer FM · ${potName()}`, text, url });
    else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showNotice("Link to the course copied.");
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") showNotice("Couldn't share that course.");
  }
}
