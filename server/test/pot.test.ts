import assert from "node:assert/strict";
import { test } from "node:test";
import { FORM_ALIGN, nextTrack, sectionAt } from "../../shared/form";
import { RESTING_BROTH } from "../../shared/types";
import { Pot } from "../src/pot";
import type { Source } from "../src/source";

const quiet: Source = {
  targets: () => RESTING_BROTH,
  ingredients: [],
  settle: () => false,
  reset: () => {},
  restAt: () => {},
  about: "a quiet room",
  rules: "Nothing comes in.",
  digest: () => "",
};

test("a jump now cuts a new track in on the next phrase, ending on the grid", () => {
  const pot = new Pot({ id: "test", name: "Test" }, quiet, () => {});
  try {
    const cycle = pot.cycleNow();
    pot.jumpTo("dubTechno", true);
    const form = pot.state.form;
    const track = nextTrack(form, cycle);
    assert.ok(track);
    assert.ok(track.cycle > cycle && track.cycle <= cycle + 6 && track.cycle % 4 === 0);
    const before = sectionAt(form, track.cycle - 1);
    assert.ok(before && before.cycle + before.length === track.cycle);
    const from = form.indexOf(track);
    for (let i = from + 1; i < form.length; i++) assert.equal(form[i].cycle, form[i - 1].cycle + form[i - 1].length);
    const last = form[form.length - 1];
    assert.equal((last.cycle + last.length) % FORM_ALIGN, 0);
  } finally {
    pot.close();
  }
});
