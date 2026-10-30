export const REGION_PARTS: Record<string, { region: string; code: string }> = {
  drift: {
    region: "ambient",
    code: `
// ambient: the same chords held for the whole bar on strings, swelling in and fading out, with a
// ninth on top and a filter that drifts by itself. It is a chord instrument the track chooses (palette.keys 6),
// and rests with the other keys (palette.chords); every breakdown borrows it, wherever the pot is,
// and near ambient it lies underneath as a soft bed, never above the level it has at rest
const drifts = palette.keys.fmap(k => k === 6 ? 1 : 0).mul(palette.chords.fmap(c => 1 - c))
const drifting = share('keys', 'drift')
const bed = part(drifting, 0.07).fmap(g => Math.min(g, 0.02))
const drift = n(coloured(stack(chord, "8".add(root)))).vib(0.3).vibmod(style.tape.mul(0.15))
  .mask(here(drifting.add(form.strip).add(drifts)))
  .scale(broth.scale)
  .s("gm_string_ensemble_1").attack(2.5).decay(2).sustain(0.7).release(5)
  .lpf(broth.warmth.range(2400, 700).add(perlin.slow(4).mul(700)))
  .pan(perlin.slow(8).range(0.35, 0.65))
  .room(0.85).roomsize(8)
  .gain(chosen(drifting, 0.07).sub(bed).mul(drifts).add(bed).add(form.strip.mul(0.05)))`,
  },
  moody: {
    region: "downtempo",
    code: `
// downtempo: half-time comping on dark chords, a chord on the one and a push on the and of two,
// then space; square through a low filter, a slow phaser and a dotted echo. It is a chord
// instrument the track chooses (palette.keys 5), and rests with the other keys (palette.chords)
const moody = only(palette.keys.fmap(k => k === 5), only(palette.chords.fmap(c => c < 1), n(coloured(chord))
  .struct("<[x ~ ~ [~ x] ~ ~ ~ ~] [x ~ ~ ~ ~ ~ [~ x] ~] [x ~ ~ [~ x] ~ ~ ~ ~] [~ ~ ~ ~ x ~ ~ ~]>")))
  .scale(broth.scale)
  .s("square").attack(0.02).decay(1.2).sustain(0.25).release(1.5)
  .lpf(broth.warmth.range(1400, 600)).lpq(2)
  .phaser(0.25).phaserdepth(0.5)
  .delay(0.35).delaytime(0.5).delayfeedback(0.45)
  .room(0.5)
  .gain(chosen(share('keys', 'moody'), 0.05))`,
  },
  acid: {
    region: "psychill",
    code: `
// psychill: a squelchy line in sixteenths over the root, its filter sweeping slowly and its dotted
// echo in time, panning around; strangeness sharpens the resonance. A track with the psychill lead
// (palette.lead 1) carries it, a gliding lead or both (palette.psyVoice)
const acid = only(palette.lead.fmap(l => l === 1), only(palette.psyVoice.fmap(v => v !== 1),
  n(coloured("<[0 ~ 7 0 ~ 4 0 ~ 2 ~ 0 7 ~ 4 ~ 0] [0 ~ 0 4 ~ 7 ~ 0 ~ 2 4 ~ 0 ~ 9 ~] [0 ~ 7 0 ~ 4 0 ~ 2 ~ 0 7 ~ 4 ~ 0] [0 0 ~ 7 ~ 4 ~ 2 ~ 0 ~ 4 7 ~ 2 ~]>".add(root)))))
  .degradeBy(broth.energy.range(0.45, 0.1))
  .scale(broth.scale)
  .s("sawtooth").decay(0.18).sustain(0).release(0.1)
  .lpf(sine.slow(16).range(400, 2000)).lpq(broth.strangeness.range(6, 14))
  .lpenv(3).lpdecay(0.15)
  .delay(0.4).delaysync(3 / 16).delayfeedback(broth.strangeness.range(0.3, 0.6))
  .pan(sine.slow(8).range(0.25, 0.75))
  .gain(chosen(share('lead', 'psy'), 0.07).mul(palette.psyVoice.fmap(v => v === 2 ? 0.7 : 1)))`,
  },
  rolling: {
    region: "psychill",
    code: `
// psychill: a round bass rolling on the track's own figure (palette.psyBass), on the root the track
// holds for bars on end, in a track that chose it (palette.bassRoll, in downtempo too); its filter
// opens and closes over 16 to 64 bars (palette.psyOpen)
const rolling = only(palette.bassRoll.fmap(b => b === 1), n(coloured(played(palette.psyBass.segment(16)).add(root))))
  .mask(open).mask(hold)
  .scale(broth.scale).transpose(-12)
  .s("sawtooth").decay(0.14).sustain(0).release(0.05)
  .lpf(palette.psyOpen.range(220, 900)).lpq(broth.strangeness.range(3, 8))
  .lpenv(1.5).lpdecay(0.1)
  .gain(chosen(share('bassRoll', 'rolling'), 0.14).mul(form.strip.fmap(x => 1 - x)).mul(form.drop.mul(0.2).add(1)))`,
  },
  psybeat: {
    region: "psychill",
    code: `
// psychill: a soft, round kick on the one with a push or two of the track's own (palette.psyKick),
// never four to the floor; a clap, rim or snare on three in half time, far off in a big room (the
// rim, a short click that would be all room, closer);
// shakers of noise and hand drums on the track's own figures, sometimes in triplets, short and
// damped. Each plays where the track chose it, at full level in the genres that play it: the push (palette.pulse 2),
// three (palette.backbeat 1), shakers and hand drums (palette.perc); the track picks its own kick,
// three and hand drums, and a block may drop the beat
const handsAt = (grid, figure) => s(palette.psyHandSound.struct(grid)).n(figure.sub(1)).mask(figure.fmap(x => x > 0))
const percIs = k => palette.perc.fmap(p => p === k || p === 3)
const psybeat = stack(
  only(palette.pulse.fmap(p => p === 2), s(palette.psyKickSound.struct("x*16")).mask(palette.psyKick.segment(16).fmap(k => k > 0)))
    .mask(open).mask(hold)
    .speed(0.9).lpf(broth.energy.range(350, 800))
    .gain(broth.energy.range(0.25, 0.45).mul(chosen(share('pulse', 'push'), 1)).mul(form.strip.fmap(x => 1 - x)).mul(palette.psyKickLevel)),
  only(palette.backbeat.fmap(b => b === 1), s(palette.psyThreeSound.struct("~ ~ x ~")).mask(palette.psyBeat.fmap(b => b > 0)).mask(open))
    .lpf(3500).room(palette.psyThreeSound.fmap(s => s === "rm:0" ? 0.2 : 0.7)).roomsize(6)
    .gain(chosen(share('backbeat', 'onThree'), 0.12).mul(form.beat).mul(palette.psyThreeLevel)),
  only(percIs(1), s("white*16").mask(palette.psyShaker.segment(16).fmap(x => x > 0)).mask(open))
    .decay(0.04).sustain(0).hpf(7000)
    .velocity(palette.psyShaker.segment(16).fmap(x => x > 1 ? 1 : 0.55))
    .pan(sine.slow(4).range(0.35, 0.65))
    .gain(chosen(share('perc', 'shakers', 'both'), 0.05).mul(form.beat).mul(form.hats)),
  only(percIs(2), stack(
    handsAt("x*16", palette.psyHand.segment(16)),
    handsAt("x*12", palette.psyTriplet.segment(12))
  ).mask(open))
    .decay(0.18).sustain(0).release(0.05)
    .pan(rand.range(0.3, 0.7)).room(0.3)
    .gain(chosen(share('perc', 'hands', 'both'), 0.12).mul(form.beat))
)`,
  },
  glide: {
    region: "psychill",
    code: `
// psychill: a few long notes on a glassy voice (palette.psyLead), now and then sliding into place
// from a step away (palette.psyGlide), in a track with the psychill lead (palette.lead 1, in
// downtempo too); a slow phaser, and a dotted echo in time carries them round
const glide = only(palette.lead.fmap(l => l === 1), only(palette.psyVoice.fmap(v => v > 0), n(coloured(played(palette.psyLead.segment(2))))))
  .scale(broth.scale).transpose(12)
  .s("sine").fm(broth.strangeness.range(0.8, 2.5)).fmh(2)
  .attack(0.4).decay(1.5).sustain(0.5).release(3).clip(2)
  .penv(palette.psyGlide).pattack(0.5)
  .phaser(0.2).phaserdepth(0.6)
  .delay(0.45).delaysync(3 / 16).delayfeedback(broth.strangeness.range(0.4, 0.65))
  .pan(sine.slow(16).range(0.3, 0.7))
  .room(0.7).roomsize(6)
  .gain(chosen(share('lead', 'psy'), 0.06).mul(palette.psyVoice.fmap(v => v === 2 ? 0.7 : 1)))`,
  },
  dub: {
    region: "dubTechno",
    code: `
// dub techno: one minor-seventh stab on an offbeat, high-passed and drowned in a dotted echo, its
// filter opening and closing over 32 bars, so the chord keeps changing colour. It is a chord
// instrument the track chooses (palette.keys 7), and rests with the other keys (palette.chords)
const dub = only(palette.keys.fmap(k => k === 7), only(palette.chords.fmap(c => c < 1), n(coloured(chord))
  .struct("<[~ x ~ ~ ~ ~ ~ ~] [~ x ~ ~ ~ ~ ~ x] [~ x ~ ~ ~ ~ ~ ~] [~ ~ ~ x ~ ~ ~ ~]>")))
  .scale(broth.scale)
  .s("sawtooth").decay(0.12).sustain(0).release(0.1)
  .lpf(sine.slow(32).range(500, 2600)).lpq(3)
  .hpf(250)
  .delay(0.6).delaytime(0.38).delayfeedback(0.7)
  .room(0.6).roomsize(6)
  .gain(chosen(share('keys', 'dub'), 0.09))`,
  },
  house: {
    region: "deepHouse",
    code: `
// deep house: short warm chord stabs in a 3-3-2 rhythm, a filtered saw under the keys where the
// track has them play house stabs (palette.role 4) and they don't rest (palette.chords)
const house = only(palette.role.fmap(r => r === 4), only(palette.chords.fmap(c => c < 1),
  n(coloured(voiceLead(shape.struct("<[x ~ ~ x ~ ~ x ~] [x ~ ~ x ~ ~ x ~] [x ~ ~ x ~ ~ x ~] [~ ~ x ~ ~ x ~ x]>").add(root))))))
  .scale(broth.scale)
  .s("sawtooth").attack(0.005).decay(0.25).sustain(0.2).release(0.2)
  .lpf(broth.warmth.range(1600, 700)).lpq(1.5)
  .room(0.45)
  .gain(chosen(share('role', 'houseStabs'), 0.02))`,
  },
  offbeat: {
    region: "deepHouse",
    code: `
// deep house: a warm bass on the offbeats between the kicks, now and then up to the fifth or the
// octave at the end of the bar, in a track that chose it (palette.bassRoll 4, which four on the
// floor brings)
const offbeat = only(palette.bassRoll.fmap(b => b === 4), n(coloured("<[~ 0]*4 [~ 0 ~ 0 ~ 0 ~ 7] [~ 0]*4 [~ 0 ~ 0 ~ 4 ~ 7]>".add(root))))
  .scale(broth.scale).transpose(-12)
  .s("sine").fm(0.5).fmh(1).attack(0.005).decay(0.2).sustain(0.3).release(0.08)
  .lpf(broth.warmth.range(800, 400))
  .asLow(chosen(share('bassRoll', 'offbeat'), 0.3).mul(form.drop.mul(0.2).add(1)))`,
  },
  glass: {
    region: "softIdm",
    code: `
// soft IDM: glassy bell tones, a six-note phrase that phases against the eight steps of the bar,
// with the odd stutter. It is a lead the track chooses (palette.lead 2)
const glass = only(palette.lead.fmap(l => l === 2), n(coloured("{0 4 2 7 1 4}%8".add(root))))
  .degradeBy(0.3)
  .sometimesBy(0.15, x => x.ply(2))
  .scale(broth.scale).transpose(12)
  .s("sine").fm(broth.strangeness.range(1.5, 4)).fmh(3.5)
  .decay(0.5).sustain(0).release(0.8)
  .delay(0.3).delaytime(0.3).delayfeedback(0.4)
  .pan(perlin.range(0.25, 0.75))
  .room(0.6)
  .gain(chosen(share('lead', 'glass'), 0.07))`,
  },
  roller: {
    region: "progPsy",
    code: `
// progressive psy: a bass rolling between the kicks, its filter opening over 32 bars, in a track
// that chose it (palette.bassRoll 5, which four on the floor brings)
const roller = only(palette.bassRoll.fmap(b => b === 5), n(coloured("[~ 0 0 0]*4".add(root))))
  .mask(open).mask(hold)
  .scale(broth.scale).transpose(-12)
  .s("sawtooth").decay(0.09).sustain(0).release(0.03)
  .lpf(sine.slow(32).range(300, 1100)).lpq(4)
  .lpenv(2).lpdecay(0.08)
  .hpf(form.lift.range(20, 500))
  .gain(chosen(share('bassRoll', 'roller'), 0.12).mul(form.beat))`,
  },
  lead: {
    region: "progPsy",
    code: `
// progressive psy: a sixteenth-note arpeggio whose filter opens over 32 bars, then starts again:
// the build. It is a lead the track chooses (palette.lead 3); its second figure touches the second,
// flat in phrygian
const lead = only(palette.lead.fmap(l => l === 3), n(coloured("<[0 2 4 7]*4 [0 1 4 7]*4 [0 4 7 9]*4 [0 2 7 4]*4>".add(root))))
  .degradeBy(0.2)
  .scale(broth.scale).transpose(12)
  .s("sawtooth").decay(0.12).sustain(0).release(0.05)
  .lpf(saw.slow(32).range(600, 3500).add(form.lift.mul(3000))).lpq(6)
  .delay(0.35).delaytime(0.33).delayfeedback(0.45)
  .pan(sine.slow(4).range(0.3, 0.7))
  .gain(chosen(share('lead', 'arpeggio'), 0.05))`,
  },
  tune: {
    region: "lofi",
    code: `
// the melody style's tune: the track's own eight-bar line as a lead, dry and clean, with a lower
// voice echoing it; at home a soft square, in psychill and soft IDM a pluck, and in house and dub
// techno a stab. It steps aside for the theme
const tune = n(coloured(sung.superimpose(x => x.add(-7).late(0.5).degradeBy(0.5))))
  .mask(here(style.melody)).mask(here(macro.homely)).mask(form.theme.fmap(t => t < 0.5))
  .scale(broth.scale).transpose(12)
  .s("square").attack(0.01).decay(0.4).sustain(0.4).release(0.6)
  .lpf(macro.wear.range(2200, 1100))
  .delay(0.25).delaysync(3 / 16).delayfeedback(0.3)
  .room(0.3)
  .gain(melodic(0.05).mul(form.beat).mul(part(macro.homely, 1)))`,
  },
  pluck: {
    region: "psychill",
    code: `
// psychill and soft IDM: the melody style's tune (see tune) as a glassy pluck, with an echo
// on the beat
const pluck = n(coloured(sung))
  .mask(here(macro.glassy)).mask(form.theme.fmap(t => t < 0.5))
  .scale(broth.scale).transpose(12)
  .s("triangle").fm(1.5).fmh(3).attack(0.005).decay(0.35).sustain(0.1).release(0.6)
  .lpf(broth.warmth.range(4500, 2000))
  .delay(0.35).delaysync(3 / 16).delayfeedback(broth.strangeness.range(0.3, 0.55))
  .pan(perlin.range(0.35, 0.65))
  .room(0.5)
  .gain(melodic(0.05).mul(form.beat).mul(part(macro.glassy, 1)))`,
  },
  stab: {
    region: "dubTechno",
    code: `
// dub techno: the melody style's tune (see tune) as a filtered stab, on the line's beats only, so
// the quick tempo doesn't turn it into a run of beeps; deep house leaves it out, its beat carries it
const beats = line.segment(4)
const stab = n(coloured(over(played(beats))))
  .mask(here(macro.echoing)).mask(form.theme.fmap(t => t < 0.5))
  .scale(broth.scale).transpose(12)
  .s("sawtooth").attack(0.005).decay(0.18).sustain(0).release(0.15)
  .lpf(sine.slow(16).range(1000, 2400)).lpq(4).hpf(400)
  .delay(0.4).delaysync(3 / 8).delayfeedback(0.45)
  .room(0.4)
  .gain(melodic(0.04).mul(form.beat).mul(part(macro.echoing, 1)))`,
  },
};
export const REGION_PART_NAMES = Object.keys(REGION_PARTS);

export const partCode = (name: string) => `${REGION_PARTS[name].code.trim()}\n${name}`;

export const partSource = (name: string) => REGION_PARTS[name].code.trim();

export async function loadRegions(evaluate: (code: string) => Promise<unknown>) {
  const regions: Record<string, unknown> = {};
  for (const name of REGION_PART_NAMES) regions[name] = await evaluate(partCode(name));
  Object.assign(globalThis, { regions });
}
