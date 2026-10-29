import assert from "node:assert/strict";
import { test } from "node:test";
import { BELLS, DRUMKITS, KEY_ROLES, KEY_SOUNDS, MOTIF_SOUNDS, SWINGS } from "../../shared/palette";
import { GENRES, PRESETS, REST, SETTINGS, shareAt, type SettingKnob } from "../../shared/presets";
import { DRONES } from "../../shared/song";

test("the settings follow the lists they choose from", () => {
  const lists: Partial<Record<SettingKnob, readonly unknown[]>> = {
    keys: KEY_SOUNDS, role: KEY_ROLES, swing: SWINGS, droneShape: DRONES, bells: BELLS, motifSound: MOTIF_SOUNDS, drums: DRUMKITS,
  };
  for (const [k, list] of Object.entries(lists)) assert.equal(SETTINGS[k as SettingKnob].length, list.length, k);
});

test("presets only name settings their knobs have", () => {
  for (const [name, knobs] of [["REST", REST], ...GENRES.map((g) => [g, PRESETS[g].knobs] as const)] as const)
    for (const [k, v] of Object.entries(knobs)) {
      if (typeof v === "number") continue;
      for (const s of Object.keys(v)) assert.ok((SETTINGS[k as SettingKnob] as readonly string[]).includes(s), `${name}.${k}.${s}`);
    }
});

test("a setting's share is the weight of the genres that may play it", () => {
  const weights = { lofi: 0.2, psychill: 0.3, downtempo: 0.1, progPsy: 0.4 };
  assert.equal(shareAt(weights, "bassRoll", ["rolling"]), 0.3 + 0.1);
  assert.equal(shareAt(weights, "keys", ["dub"]), 0.4);
  assert.equal(shareAt(weights, "pulse", ["boomBap"]), 0.2);
  assert.throws(() => shareAt(weights, "pulse", ["polka"]));
  assert.throws(() => shareAt(weights, "polka" as SettingKnob, ["none"]));
});
