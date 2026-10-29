export const SCORE_NAMES = [
  "root", "shape", "chord", "voiceLead", "led", "over", "played", "line", "sung",
  "grooves", "onEighths", "tuned", "open", "hold", "low",
  "floor", "club", "gen", "thin", "kitKick", "kitHats", "snareBeat", "evened",
] as const;
export const SCORE_FUNCTIONS = ["voiceLead", "over", "played", "grooves", "onEighths", "tuned", "evened"];
export const SCORE_METHODS = ["asLow", "asBeat", "asHats"];

export const SCORE = `
// the harmony: the track's progression (palette.root), stacked in its voicing
const root = palette.root
const voiced = v => palette.voicing.fmap(x => x === v)
// the chord as stacked over its root; a part that plays it in a rhythm of its own adds the root
// after its rhythm, so every hit reads the chord at its own onset and a pushed chord comes early
const shape = stack(
  "[0,2,4,6]".mask(voiced(0)),
  "[-3,0,2,4]".mask(voiced(1)),
  "[0,4,6,8]".mask(voiced(2)),
  "[2,4,6,8]".mask(voiced(3)),
  "[0,2,6]".mask(voiced(4)),
  "[0,2,5,8]".mask(voiced(5)),
  "[0,3,6]".mask(voiced(6))
)
const chord = shape.add(root)
// the keys lead their voices like a pianist: a note that would climb out of the middle comes back
// an octave, so the next chord is an inversion close to the last
const voiceLead = notes => notes.fmap(x => x > 6 ? x - 7 : x < -3 ? x + 7 : x)
const led = voiceLead(chord)
// melodies keep to the key; only a fourth above the chord's root, which rubs, steps down to its third
const over = notes => notes.sub(root).fmap(x => ((x % 7) + 7) % 7 === 3 ? x - 1 : x).add(root)
// a figure's notes without its rests, written as -99
const played = notes => notes.mask(notes.fmap(x => x > -99))
// the track's own melody (palette.line), eight bars of a phrase, its variation and an answer; like
// every pitched part it goes through coloured(...) last, so it takes the colour of its chord
const line = palette.line.segment(8)
const sung = over(played(line))
// the groove picks the ghost notes and hats, the kit tunes the drums
const grooves = figures => palette.groove.pick(figures)
// a figure's notes on eighths, and the ones a sixteenth after their eighth
const onEighths = (figure, v) => figure.segment(8).fmap(x => x === v)
const tuned = speeds => palette.kit.fmap(k => speeds[k])
// the low end leaves in a breakdown and is back at the drop; it holds its breath before a big
// drop (open) and stops for a kick break (hold)
const low = form.strip.fmap(x => 1 - x)
const open = form.gap.fmap(g => g < 0.5)
const hold = form.fill.fmap(f => f !== 2)
// the clubbier regions, whose tracks may play a kick on every beat; whether one plays is the track's
// choice (palette.pulse 5). club was the weight of the regions whose kick still came with it, and no
// region's does any more, so it is 0; courses may still read it
const floor = share('pulse', 'fourFloor')
const club = floor.mul(0)
// the generative style is soft IDM's: it steps back where the music carries one melody, and thins
// out the keys, pad and hats
const gen = style.gen.mul(macro.focus.fmap(w => 1 - w))
const thin = gen.fmap(g => 1 - 0.6 * g)
// the track's choices of beat (presets.ts): the boom-bap kick, the hats that go with it or with four
// on the floor, the snare on two and four
const kitKick = palette.pulse.fmap(p => p < 2)
const kitHats = palette.pulse.fmap(p => p < 2 || p === 5)
const snareBeat = palette.backbeat.fmap(b => b < 1)
// a kit's level (palette.kickLevel, …), which evens the kits out; the melody style's 808 plays as it is
const evened = level => level.sub(1).mul(style.melody.fmap(m => m > 0.5 ? 0 : 1)).add(1)
// the parts' roles in a track, each a method that masks the part and sets its gain: its own level,
// times what the role leaves of it. The low end (kick, bass) leaves in a breakdown, holds its breath
// and stops for a kick break; the beat (the snare) holds its breath and plays what's left of the
// beat; the hats do too, and rest in the blocks that rest them
register('asLow', (level, pat) => pat.mask(open).mask(hold).gain(low.mul(level)), false)
register('asBeat', (level, pat) => pat.mask(open).gain(form.beat.mul(level)), false)
register('asHats', (level, pat) => pat.mask(open).gain(form.beat.mul(form.hats).mul(level)), false)
`.trim();

export async function loadScore(evaluate: (code: string) => Promise<unknown>) {
  const into = "keepScore";
  const g = globalThis as Record<string, unknown>;
  g[into] = (score: Record<string, unknown>) => Object.assign(globalThis, score);
  await evaluate(`${SCORE}\n${into}({ ${SCORE_NAMES.join(", ")} })\nsilence`);
  delete g[into];
}
