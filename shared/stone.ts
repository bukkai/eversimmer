export const STONE = `
// the track's choice of bass (presets.ts): the stone's figure
const figureBass = palette.bassRoll.fmap(b => b < 1)

// lo-fi: the keys, comping behind the beat, the track's arpeggio, held or resting, in the palette's
// register; role and instrument are picked once a bar, so only the keys that play get worked out
const up = palette.octave.fmap(o => o > 0 ? 7 : o < 0 ? -3 : 0)
const arp = palette.arp.segment(8)
const comped = v => n(coloured(voiceLead(shape.struct(onEighths(palette.comp, v)).add(root)).add(up)))
const keyNotes = palette.role.segment(1).fmap(r => r >= 0 && r <= 4 ? r : 3).pick([
  swung(stack(comped(1), comped(2).late(1 / 16))),
  n(coloured(played(arp).add(root).add(up))),
  n(coloured(led.add(up))),
  silence,
  // deep house's stabs in 3-3-2, a saw under them (regions.house)
  n(coloured(voiceLead(shape.struct("<[x ~ ~ x ~ ~ x ~]!3 [~ ~ x ~ ~ x ~ x]>").add(root)).add(up)))
])
  .scale(broth.scale)
  .vib(palette.wow.range(0.35, 0.7)).vibmod(style.tape.mul(0.2).add(palette.wow.range(0.03, 0.12)))
// on the track's instrument, each at a level that sits it alike in the mix, as bright and ringing
// as long as the track has it; in deep house muted, softer and darker, under the drums; soft IDM's
// arpeggios play here too
const brighter = palette.bright.range(0.75, 1.3).mul(unless(macro.muted, 0.4))
const keysAs = (i, level, sound) => sound(palette.keys.segment(1).fmap(k => k === i ? 1 : 0).pick([silence, keyNotes]))
  .late(perlin.range(0, 0.025))
  .velocity(perlin.slow(4).range(0.7, 0.9).add(rand.range(0, 0.1)))
  .delay(broth.strangeness.range(0.1, 0.55)).delaytime(0.4).delayfeedback(broth.strangeness.range(0.2, 0.65))
  .room(0.5).roomsize(macro.wear.range(4, 2))
  .shape(style.tape.mul(0.35))
  .gain(part(macro.keys, 0.1 * level).mul(form.strip.mul(0.4).add(1)).mul(thin).mul(unless(macro.muted, 0.45)))
const keys = palette.chords.fmap(c => 1 - c).mul(here(macro.keys)).pick([silence, stack(
  // a soft electric piano, rounder in lo-fi
  keysAs(0, 1, p => p.s("sine").fm(broth.warmth.range(2.5, 1).mul(macro.wear.range(1, 0.6)).mul(brighter)).fmh(2)
    .attack(macro.wear.range(0.01, 0.025)).decay(palette.ring.range(0.8, 2.2)).sustain(0.3).release(2).lpf(broth.warmth.range(3200, 900).mul(brighter))),
  // a piano, the sampled grand, muffled like felt on old tape
  keysAs(1, 1.1, p => p.s("piano")
    .decay(palette.ring.range(1.5, 3.5)).sustain(0).release(0.8).lpf(broth.warmth.range(2600, 900).mul(brighter))),
  // an organ: sustained, a whole-number ratio, a slow vibrato
  keysAs(2, 0.6, p => p.s("sine").fm(0.7).fmh(1)
    .attack(0.03).decay(0.3).sustain(0.6).release(0.4).vib(5).vibmod(0.08).lpf(unless(macro.muted, 0.4).mul(2400))),
  // a vibraphone: a bright metallic ratio that rings out and wobbles
  keysAs(3, 0.9, p => p.s("sine").fm(1.6).fmh(4)
    .attack(0.005).decay(palette.ring.range(1, 2.6)).sustain(0).release(1.8).vib(4).vibmod(0.12)),
  // a soft square, like an old home keyboard, well filtered
  keysAs(4, 0.5, p => p.s("square")
    .attack(0.01).decay(0.6).sustain(0.2).release(0.8).lpf(broth.warmth.range(1600, 700)))
)])

// short offbeat chord stabs once the room is really going, but not in deep house, which has its own
const stabs = n(coloured(shape.struct("[~ x]*4").add(root)))
  .scale(broth.scale)
  .s("sine").fm(1.5).fmh(3)
  .decay(0.15).sustain(0)
  .lpf(broth.warmth.range(4000, 1500))
  .room(0.4)
  .gain(swell(broth.energy, 0.62, 0.85, 0.05).mul(form.beat).mul(unless(macro.muted, 1)))

// a slow pad underneath on root and fifth, the ambient half of home, held until the chord changes;
// the track plays it in full, as a quiet, darker bed or not at all (palette.pad), and it never
// swells in a breakdown. Tension detunes it and strangeness sets its filter wandering
const pad = n("[0,4]".add(root))
  .mask(palette.chordBars.fmap(b => b > 0)).clip(palette.chordBars)
  .scale(broth.scale).transpose(-12)
  .s("supersaw").unison(3)
  .detune(broth.tension.range(0.05, 0.5).add(style.tape.mul(0.3)))
  .vib(0.3).vibmod(style.tape.mul(0.15))
  .attack(2).release(4)
  .lpf(broth.warmth.range(1600, 400).add(sine.slow(8).mul(broth.strangeness.range(0, 1400))).mul(palette.pad.fmap(p => p === 1 ? 0.6 : 1)))
  .lpq(broth.strangeness.range(1, 6))
  .room(0.8).roomsize(7)
  .gain(palette.pad.fmap(p => [0.07, 0.03, 0][p]).mul(form.pad).mul(thin))

// dissonant extensions fade in with tension
const tense = n("<[1,5] [6,10] [3,8] [1,6]>/2")
  .scale(broth.scale)
  .s("triangle").attack(2).release(4)
  .room(0.8)
  .gain(swell(broth.tension, 0.25, 1, 0.15).mul(unless(macro.muted, 0.8)))

// a bass with the kick, the track's own figure, a busier line on top as energy rises; the track
// picks its sound (palette.bassTone): a sine, a triangle or a pluck. In lo-fi it wobbles a little
const lowNotes = figure => played(figure.segment(8)).add(root)
const bassNotes = n(coloured(swung(stack(lowNotes(palette.low), lowNotes(palette.lowLate).late(1 / 16)))))
  .scale(broth.scale).transpose(-12)
  .vib(0.5).vibmod(macro.wear.mul(palette.wow.range(0.03, 0.07)))
const bassIs = b => palette.bassTone.fmap(x => x === b)
const bass = stack(
  only(figureBass, stack(
    only(bassIs(0), bassNotes).s("sine").decay(0.8).sustain(0.4).release(0.5).lpf(500),
    only(bassIs(1), bassNotes).s("triangle").decay(0.6).sustain(0.3).release(0.4).lpf(650),
    only(bassIs(2), bassNotes).s("sine").fm(0.6).fmh(1).decay(0.35).sustain(0.1).release(0.3).lpf(900)
  )),
  // downtempo's: the figure in long, deep notes
  only(palette.bassRoll.fmap(b => b === 2), bassNotes).s("sine").attack(0.02).sustain(0.9).release(0.6).clip(3).lpf(280)
)
  .asLow(broth.energy.range(0.2, 0.4).mul(form.drop.mul(0.3).add(1))
    .mul(palette.bassTone.fmap(b => [1, 0.9, 1.2][b])))
const bassline = only(figureBass, n(coloured("<[~ 0 ~ 0 ~ 4 ~ 2] [~ 0 ~ 2 ~ 4 ~ 0] [~ 0 ~ 4 ~ 0 ~ 4] [~ 4 ~ 2 ~ 0 ~ 2]>".add(root))))
  .scale(broth.scale).transpose(-12)
  .s("sine").decay(0.25).sustain(0)
  .lpf(800)
  .asLow(swell(broth.energy, 0.45, 0.75, 0.3).add(form.bass.mul(0.15)))

// the bells, as the palette has them: scattered, a glass or music-box motif, or none; strangeness
// sets them drifting; psychill hears them darker and softer. Lo-fi carries one melody at most:
// there only a motif plays, it steps aside for the theme, and the tape and melody leads step aside
// for it
const bellMotif = palette.bells.fmap(b => b === 1 || b === 2 ? 1 : 0)
const bellsAre = b => palette.bells.fmap(x => x === b)
// the motif is the track's melody, thinner in a quiet room; beside the tune (regions.tune) it
// answers it
const answer = palette.bellLine.segment(8)
const motif = melodic(1).segment(1).fmap(x => x > 0.3 ? 1 : 0)
  .pick([sung, over(played(answer))])
  .degradeBy(broth.density.range(0.5, 0.15))
const ring = notes => notes
  .scale(broth.scale).transpose(12)
  .vib(0.5).vibmod(style.tape.mul(0.2))
  .pan(rand.sub(0.5).mul(broth.strangeness).add(0.5))
  .delay(0.4).delaytime(0.6).delayfeedback(broth.strangeness.range(0.3, 0.6))
  .lpf(macro.wear.range(9000, 2800).mul(unless(macro.veiled, 0.6)))
  .room(0.6)
const bellsGain = level => beside(macro.focus, form.theme).mul(level).mul(unless(macro.veiled, 0.4))
// the motif sings in the track's own voice (palette.motifSound): the bells the palette picks, or a
// soft flute, or a muted pluck like a guitar with the palm on its strings
const sings = v => palette.motifSound.fmap(x => x === v)
const motifNotes = only(bellMotif.fmap(m => m > 0), n(coloured(motif)))
const bells = stack(
  ring(only(bellsAre(0), n(irand(8).segment(8).add("<0 2>/8")).degradeBy(broth.density.range(0.95, 0.35))))
    .s("triangle").decay(0.3).sustain(0).gain(bellsGain(0.12).mul(unless(macro.focus, 1)).mul(unless(macro.veiled, 0.8))),
  ring(only(bellsAre(1), only(sings(0), motifNotes)))
    .s("sine").fm(2).fmh(3.5).decay(0.6).sustain(0).gain(bellsGain(0.09)),
  ring(only(bellsAre(2), only(sings(0), motifNotes)))
    .s("triangle").fm(1).fmh(5).decay(0.9).sustain(0).lpf(5000).gain(bellsGain(0.08)),
  ring(only(sings(1), motifNotes))
    .s("sine").attack(0.04).decay(0.5).sustain(0.35).release(0.8).lpf(macro.wear.range(5000, 2200))
    .gain(bellsGain(0.06)),
  ring(only(sings(2), motifNotes))
    .s("triangle").decay(0.22).sustain(0).release(0.1).lpf(1600)
    .gain(bellsGain(0.11))
)

// the pot's own theme, the same everywhere, opening a track now and then, played the region's way:
// a soft piano at home, glass in psychill and soft IDM, an echoing stab where the kick is on every
// beat. The tape and melody leads step aside for it
const theming = form.theme.fmap(t => t > 0.5)
const besideTheme = form.theme.fmap(t => t < 0.5)
const themeNotes = n(coloured(over("<[4 ~ ~ 7 ~ ~ 6 4] [2 ~ ~ ~ ~ ~ ~ ~] [4 ~ ~ 7 ~ ~ 9 7] [6 ~ ~ 4 ~ 2 ~ ~]>")))
  .mask(theming)
  .scale(broth.scale).transpose(12)
  .vib(0.5).vibmod(style.tape.mul(0.2))
  .shape(style.tape.mul(0.25))
const theme = stack(
  themeNotes.mask(here(macro.homely))
    .s("piano")
    .attack(macro.bloom.range(0.005, 0.6)).decay(1.8).sustain(0).release(1.5)
    .lpf(broth.warmth.range(3000, 1200))
    .delay(0.3).delaytime(0.375).delayfeedback(0.35)
    .room(0.6).roomsize(5)
    .gain(part(macro.homely, 0.08)),
  themeNotes.mask(here(macro.glassy))
    .s("sine").fm(2).fmh(3.5).decay(0.7).sustain(0).release(1)
    .delay(0.35).delaytime(0.3).delayfeedback(0.4)
    .pan(perlin.range(0.35, 0.65))
    .room(0.6)
    .gain(part(macro.glassy, 0.08)),
  themeNotes.mask(here(floor))
    .s("sawtooth").decay(0.2).sustain(0.1).release(0.2)
    .lpf(sine.slow(32).range(900, 2600)).lpq(3).hpf(300)
    .delay(0.5).delaytime(0.375).delayfeedback(0.55)
    .room(0.5)
    .gain(part(floor, 0.05))
)

// a faint hiss, the dust on the record
const dust = s("pink")
  .attack(1).release(1)
  .hpf(4000)
  .gain(broth.warmth.range(0.004, 0.012).add(style.tape.mul(0.012)).mul(palette.vinyl.range(0.7, 1.3)))

// tape: a short, worn motif on a detuned, saturated saw, from another note in every track
const worn = n(coloured(over("<[0 ~ ~ 2 ~ ~ 4 ~] [~ ~ ~ ~ 2 ~ ~ ~] [0 ~ ~ 2 ~ ~ 4 ~] [~ ~ 6 ~ 4 ~ ~ ~]>"
    .add(palette.motif.fmap(m => [0, 2, -1, 4][m])))))
  .mask(here(style.tape)).mask(besideTheme)
  .scale(broth.scale).transpose(12)
  .s("sawtooth").attack(0.05).decay(0.8).sustain(0.3).release(1.5)
  .lpf(1400).vib(0.6).vibmod(0.25).shape(0.25)
  .room(0.6)
  .gain(part(style.tape, 0.05).mul(form.beat).mul(beside(macro.focus, bellMotif)).mul(unless(macro.muted, 1)))

// generative: clicks in shifting euclidean rhythms, and metallic blips phasing against the bar
const clicks = s("<click:2 tink:1 perc:3 click:0 tink:3>")
  .euclidRot("<3 5 7 5 3 7>", 16, "<0 3 7 2 5>")
  .mask(here(gen))
  .speed(rand.range(0.8, 1.6))
  .pan(rand.range(0.2, 0.8))
  .hpf(1500)
  .gain(part(gen, 0.12).mul(form.beat))
const metal = n("{0 3 7 10 5}%16".add(root))
  .mask(here(gen))
  .degradeBy(sine.slow(16).range(0.2, 0.8))
  .scale(broth.scale).transpose(12)
  .s("sine").fm(4).fmh(1.41).decay(0.07).sustain(0)
  .pan(perlin.range(0.2, 0.8))
  .delay(0.3).delaytime(0.19).delayfeedback(0.35)
  .gain(part(gen, 0.07).mul(unless(macro.muted, 0.8)))

// one melodic voice per person present, up to six, each in short phrases out of step with the
// others; valence lifts the register, lo-fi quiets them and deep house nearly silences them
const timbres = ["sine", "triangle", "sine", "triangle", "sine", "triangle"]
const voices = timbres.map((timbre, i) =>
  n(irand(5).early(i * 0.37).segment([3, 4, 5, 2, 6, 4][i]).add(i * 2)
      .add(broth.valence.fmap(v => v > 0.33 ? 7 : 0)))
    .mask("<1 1 0 1 0 0>".early(i * 2))
    .scale(broth.scale)
    .s(timbre).attack(0.03).decay(0.4).sustain(0.15).release(0.7)
    .lpf(broth.warmth.range(3500, 1200))
    .degradeBy(0.5).pan(0.15 + i * 0.14)
    .room(0.6)
    .gain(broth.voices.fmap(v => v > i ? (timbre === "sine" ? 0.1 : 0.06) : 0).mul(unless(macro.focus, 0.85)).mul(unless(macro.veiled, 0.7)).mul(unless(macro.muted, 0.85)))
)

// in lo-fi the crackle of the vinyl, more when it's warm, on tape and on a worn record
const crackle = s("crackle")
  .mask(here(macro.wear))
  .density(broth.warmth.range(0.015, 0.04).mul(palette.vinyl.range(0.6, 1.4)))
  .attack(0.05).release(0.1)
  .hpf(700).lpf(6000)
  .gain(part(macro.wear, 0.05).add(style.tape.mul(0.02)).mul(palette.vinyl.range(0.7, 1.3)))

stack(
  keys, regions.drift, regions.moody, regions.acid, regions.dub, regions.house, regions.glass,
  regions.roller, regions.lead, regions.rolling, regions.offbeat, regions.psybeat, regions.glide,
  stabs, pad, tense, bass, bassline,
  drums.kick, drums.pushedKick, drums.hats, drums.fastHats, drums.openHats, drums.snare, drums.clap, drums.ghosts, drums.rim,
  drums.tabla, drums.heart, drums.fourFloor, drums.roll, drums.riser, drums.crash, drums.fills, drums.ticks, bells, theme, dust, crackle, worn, regions.tune, regions.pluck, regions.stab, clicks, metal, ...voices
)
`.trim();
