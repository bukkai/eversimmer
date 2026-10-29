import assert from "node:assert/strict";
import { test } from "node:test";
import { FORM_ALIGN, formUntil, planTrack, type Section } from "../../shared/form";
import { REGIONS } from "../../shared/map";
import { seeded } from "../../shared/numbers";
import { choosePalette, tidesAt } from "../../shared/palette";

const contiguous = (form: Section[]) => form.every((s, i) => i === 0 || form[i - 1].cycle + form[i - 1].length === s.cycle);

test("a planned track is a row of sections without gaps, opening once and ending on the grid", () => {
  for (const region of REGIONS)
    for (let seed = 1; seed <= 20; seed++) {
      const random = seeded(seed);
      const palette = choosePalette(tidesAt(seed * 3_600_000), undefined, { [region.id]: 1 }, random);
      const form = planTrack(64, random(), 0.45, region.at, { opening: "drop", palette }, random);
      assert.ok(contiguous(form), `${region.id}, seed ${seed}: sections leave a gap`);
      assert.ok(form.every((s) => s.length > 0), `${region.id}, seed ${seed}: an empty section`);
      assert.equal(form.filter((s) => s.opens).length, 1);
      assert.equal(form[0].cycle, 64);
      const end = form.at(-1)!.cycle + form.at(-1)!.length;
      assert.equal(end % FORM_ALIGN, 0, `${region.id}, seed ${seed}: the track ends off the grid`);
    }
});

test("the same seed plans the same track", () => {
  const plan = () => {
    const random = seeded(99);
    const palette = choosePalette(tidesAt(0), undefined, { lofi: 1 }, random);
    return planTrack(0, 0.5, 0.4, REGIONS[0].at, { palette }, random);
  };
  assert.deepEqual(plan(), plan());
});

test("formUntil drops what comes later and cuts the section playing then", () => {
  const random = seeded(5);
  const palette = choosePalette(tidesAt(0), undefined, { lofi: 1 }, random);
  const form = planTrack(0, 0.5, 0.4, REGIONS[0].at, { palette }, random);
  const cut = form[0].cycle + Math.floor(form[0].length / 2);
  const kept = formUntil(form, cut);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].cycle + kept[0].length, cut);
  assert.ok(contiguous(kept));
  assert.equal(form[0].length > kept[0].length, true, "the original form is left alone");
});
