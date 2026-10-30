import { settingOf } from "./presets";

const RIMSHOT = settingOf("drums", "rimshot");

export const DRUM_PARTS: Record<string, { code: string }> = {
  kick: {
    code: `
// the kick, the track's own figure on sixteenths, where the track plays the boom-bap kick; the heavy
// boom-bap (palette.pulse 1) is the same kick, louder and lower
const heavy = palette.pulse.fmap(p => p === 1 ? 1 : 0)
const kick = only(kitKick, swung(kit(palette.kickSound.struct("x*16"), "808bd:3*16").mask(palette.kick.segment(16).fmap(k => k > 0)))
  .speed(tuned([1, 0.88, 1.08]).mul(heavy.mul(-0.06).add(1)))
  .lpf(macro.drive.range(900, 2400))
  .shape(macro.dust)
  .asLow(macro.drive.range(0.08, 0.5).add(macro.steady.mul(0.1)).mul(evened(palette.kickLevel)).mul(heavy.mul(0.3).add(1))))`,
  },
  heart: {
    code: `
// ambient's distant heartbeat (palette.pulse 3): the one, soft and far
const heart = only(palette.pulse.fmap(p => p === 3), s("bd:3")).lpf(250).room(0.5).asLow(0.15)`,
  },
  pushedKick: {
    code: `
// a pushed kick before the one, once the room is going
const pushedKick = only(kitKick, swung(s("~ ~ ~ [~ bd:3] bd:3 ~ ~ ~"))
  .lpf(2000)
  .asLow(swell(macro.drive, 0.45, 0.7, 0.4)))`,
  },
  fourFloor: {
    code: `
// a kick on every beat on the track's kit, where the track chose it (palette.pulse 5: deep house's,
// dub techno's, muffled and a little softer the deeper the pot is in dub techno, and progressive
// psy's, tighter and brighter)
const fourFloor = only(palette.pulse.fmap(p => p === 5), s(palette.kickSound.struct("x*4")))
  .lpf(macro.drive.range(1200, 3000).mul(macro.muffle.range(1, 0.3)).mul(macro.tight.range(1, 1.4)))
  .asLow(macro.drive.range(0.4, 0.6).mul(chosen(floor, 1)).mul(macro.muffle.range(1, 0.8)).mul(evened(palette.kickLevel)))`,
  },
  snare: {
    code: `
// the snare on two and four, where the track has it
const snare = only(snareBeat, swung(kit(palette.snareSound.struct("~ ~ x ~ ~ ~ x ~"), "~ ~ 808sd:1 ~ ~ ~ 808sd:1 ~"))
  .speed(tuned([1, 0.94, 1.1]))
  .shape(macro.dust)
  .lpf(macro.drive.range(2500, 6000)).room(palette.drums.fmap(d => d === ${RIMSHOT} ? 0.05 : 0.3))
  .asBeat(atLeast(swell(macro.drive, 0.15, 0.45, 1), 0.6).mul(0.3).mul(evened(palette.snareLevel))))`,
  },
  ghosts: {
    code: `
// ghost notes on the snare, the groove's figure, as the room gets going
const ghosts = only(snareBeat, swung(s(palette.snareSound.struct(grooves([
  "~ [~ x] ~ ~ [~ x] ~ ~ [x ~]",
  "~ ~ ~ [~ x] ~ ~ ~ [~ x]",
  "[~ x] ~ ~ ~ ~ [~ x] [~ x] ~",
  "~ ~ [~ x] ~ ~ ~ ~ [x x]"
]))))
  .speed(tuned([1, 0.94, 1.1]))
  .mask(open)
  .lpf(4000)
  .gain(atLeast(swell(macro.drive, 0.5, 0.8, 1), 0.5).mul(0.07).mul(low).mul(palette.snareLevel)))`,
  },
  hats: {
    code: `
// the hats, the groove's figure, thin out at random in a calm room, but keep running in lo-fi and
// deep house, accented on the beat and duller in lo-fi
const hats = only(kitHats, swung(s(palette.hatSound.struct(grooves([
  "x*8",
  "x x x x x x x [x x]",
  "[x ~ x x]*2",
  "<[x ~ x x ~ x x ~] [x ~ x ~ x x ~ x]>"
]))))
  .degradeBy(macro.drive.range(0.9, 0.1).mul(macro.running.fmap(g => 1 - 0.8 * g)))
  .late(macro.drag.range(0, 0.03))
  .velocity("1 0.65 0.85 0.65 1 0.65 0.85 0.7")
  .hpf(macro.wear.range(6000, 4500)).lpf(macro.wear.range(10000, 7000))
  .asHats(thin.mul(0.12).mul(palette.hatLevel)))`,
  },
  fastHats: {
    code: `
// sixteenth hats once the room is really going
const fastHats = only(kitHats, s("hh*16")
  .degradeBy(0.35)
  .hpf(8000)
  .asHats(swell(macro.drive, 0.55, 0.85, 0.07)))`,
  },
  openHats: {
    code: `
// open hats on the offbeat, on the track's kit: where the track chose them (palette.perc 5, deep
// house's and dub techno's, quieter there and over a little hiss), and elsewhere at the top of the
// room's energy, leaning towards house
const housed = palette.perc.fmap(p => p === 5)
const openHats = stack(
  only(housed, s(palette.openSound.struct("[~ x]*4")))
    .asHats(macro.drive.range(0.09, 0.14).mul(chosen(share('perc', 'openHats'), 1)).mul(macro.muffle.range(1, 0.55))),
  only(housed.fmap(h => !h), only(kitHats, s(palette.openSound.struct("[~ x]*4"))))
    .asHats(swell(macro.drive, 0.65, 0.9, 0.1)),
  only(housed, s("pink").mask(here(macro.muffle)))
    .attack(0.5).sustain(1).release(0.5).lpf(9000)
    .gain(part(macro.muffle, 0.012))
)
  .hpf(5000)`,
  },
  roll: {
    code: `
// a build's snare roll that doubles towards the drop, where the region builds that way
const rollAt = (from, to) => form.rush.fmap(r => r >= from && r < to)
const roll = stack(
  s("sd:1*4").mask(rollAt(0.3, 0.6)),
  s("sd:1*8").mask(rollAt(0.6, 0.85)),
  s("sd:1*16").mask(rollAt(0.85, 2))
)
  .mask(open)
  .lpf(form.rush.range(1500, 8000))
  .gain(form.rush.mul(0.22))`,
  },
  riser: {
    code: `
// a build's rising rush of noise, where the region builds that way
const riser = s("white*8")
  .mask(here(form.rush))
  .mask(open)
  .sustain(1).release(0.05)
  .hpf(form.rush.range(300, 9000))
  .gain(form.rush.fmap(r => r * r * 0.05))`,
  },
  crash: {
    code: `
// a crash at the drop
const crash = s("<cr ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~>")
  .mask(form.drop.fmap(d => d > 0.3))
  .lpf(7000)
  .room(0.4)
  .gain(form.drop.mul(0.1))`,
  },
  fills: {
    code: `
// fills in the last bar of every block: a snare figure, a kick break (see 'hold' in the score), a
// tom run or a noise swell, at the level of the kit
const fillIs = k => form.fill.fmap(f => f === k)
const fills = stack(
  only(snareBeat, s("~ ~ [~ sd:1] [sd:1 sd:1 [sd:1 sd:1] sd:1]").mask(fillIs(1)))
    .lpf(5000).gain(macro.drive.range(0.08, 0.3)),
  only(kitKick, s("~ ~ ~ [ht mt [mt lt] lt]").mask(fillIs(3)))
    .lpf(4000).room(0.3).gain(macro.drive.range(0.1, 0.3)),
  s("white*8").mask(fillIs(4))
    .sustain(1).release(0.05)
    .hpf(saw.range(600, 7000))
    .gain(saw.mul(macro.drive.range(0.015, 0.04)))
)`,
  },
  clap: {
    code: `
// house's clap on two and four, on the track's kit, where the track chose it (palette.backbeat 3)
const clap = only(palette.backbeat.fmap(b => b === 3), s(palette.clapSound.struct("~ x ~ x")))
  .lpf(macro.drive.range(4000, 8000)).room(0.25)
  .asBeat(macro.drive.range(0.2, 0.32).mul(chosen(share('backbeat', 'clap'), 1)))`,
  },
  rim: {
    code: `
// rimshots, as a busy room brings them in, where the track plays the snare
const rim = only(snareBeat, swung(s("~ ~ ~ rm ~ ~ [~ rm] ~"))
  .gain(swell(macro.busy, 0.35, 0.7, 0.18)))`,
  },
  tabla: {
    code: `
// hand drums for a busier room still, where the track has none of psychill's own (palette.perc 0)
const tabla = only(palette.perc.fmap(p => p < 1), s("tabla*8").n(irand(16))
  .degradeBy(0.4)
  .pan(rand.range(0.3, 0.7))
  .room(0.3)
  .gain(swell(macro.busy, 0.5, 0.85, 0.12)))`,
  },
  ticks: {
    code: `
// soft IDM's clicks, where the track chose them (palette.perc 6): a click and a tink on Euclidean
// rhythms of the track's own that turn against each other, with the odd stutter, dry and spread wide
const ownOf = (k, xs) => palette.figure.segment(1).fmap(f => xs[Math.floor(f / k) % xs.length])
const ticks = only(palette.perc.fmap(p => p === 6), stack(
  s("click:2").euclidRot(ownOf(1, [5, 7, 9]), 16, ownOf(3, [0, 2, 3, 5])),
  s("tink:1").euclidRot(ownOf(12, [3, 5]), 16, "<0 3 6 1>").speed(ownOf(24, [1, 1.2, 0.85]))
))
  .sometimesBy(0.12, x => x.ply(2))
  .velocity(rand.range(0.6, 1))
  .hpf(1500)
  .pan(perlin.range(0.2, 0.8))
  .asHats(chosen(share('perc', 'clicks'), 0.1))`,
  },
};
export const DRUM_PART_NAMES = Object.keys(DRUM_PARTS);

export const drumCode = (name: string) => `${DRUM_PARTS[name].code.trim()}\n${name}`;

export const drumSource = (name: string) => DRUM_PARTS[name].code.trim();

export async function loadDrums(evaluate: (code: string) => Promise<unknown>) {
  const drums: Record<string, unknown> = {};
  for (const name of DRUM_PART_NAMES) drums[name] = await evaluate(drumCode(name));
  Object.assign(globalThis, { drums });
}
