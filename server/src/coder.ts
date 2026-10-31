import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { blockInfo, FORM_ALIGN, nextTrack, paletteAt, sectionAt, type Section } from "../../shared/form";
import { HELPER_DOCS } from "../../shared/helpers";
import { MACRO_NAMES, MACROS, type Macro } from "../../shared/macros";
import { GENRES, PRESETS } from "../../shared/presets";
import { AXES, BEATS_PER_CYCLE, REGIONS, weightsAt } from "../../shared/map";
import { describePalette, describeStyle, styleWeights, trackKey, type Tides } from "../../shared/palette";
import { DRUM_PART_NAMES, drumSource } from "../../shared/drums";
import { partSource, REGION_PART_NAMES, REGION_PARTS } from "../../shared/regions";
import { SCORE, SCORE_NAMES } from "../../shared/score";
import { ingredientWeightAt, KEYS, scaleFor, type Broth, type Ingredient, type PotMap } from "../../shared/types";
import { CALLABLE, LIMITS, MAX_CODE_LENGTH, MAX_OUTPUT_TOKENS, SAMPLES, SYNTHS } from "./course-rules";
import { DRUM_MACHINES, INSTRUMENTS } from "../../shared/sounds";
import type { Source } from "./source";
import { difference, splice } from "./splice";
import { logUsage } from "./usage";
import type { Verdict } from "./validate-worker";

const fedBy = (m: Macro) =>
  GENRES.filter((g) => PRESETS[g].macros?.[m] !== undefined)
    .map((g) => (PRESETS[g].macros![m] === 1 ? `genre.${g}` : `genre.${g} × ${PRESETS[g].macros![m]}`))
    .join(" + ")

const MODEL = "claude-sonnet-5-5";
const COURSE_MIN_MS = 5 * 60_000;
const COURSE_MAX_MS = 8 * 60_000;
const SHIFT_MIN_MS = 3 * 60_000;
const SHIFT_DISTANCE = 0.35;
const CALM_DISTANCE = 0.1;
const CALM_MAX_MS = 15 * 60_000;
const INGREDIENT_NOTICED = 0.1;
const EMPTY_TO_STONE_MS = 10 * 60_000;
const CHECK_MS = 20_000;
const DIFFERENCE_SHARE = 0.7;

const systemFor = ({ about, rules }: Pick<Source, "about" | "rules">) => `You are the resident live coder of Eversimmer FM, a perpetual music stream that plays beside ${about}, 24 hours a day. Every browser in the room plays the same Strudel code in sync. Every ten minutes or so you rewrite the code a little, so the music drifts with the room over hours. People listen for a long time, often while working or talking, so the music should stay pleasant, unhurried and never harsh.

## How the music hears the room

The code reads the room through the global \`broth\`, a set of continuous Strudel signals that move by themselves between your rewrites:
- broth.valence: -1 sad … 1 happy. Mind the range: .range(a, b) assumes 0 … 1, so read valence with .fmap(v => ...).
- broth.energy: 0 calm … 1 intense
- broth.density: 0 sparse … 1 busy (how much people are talking)
- broth.tension: 0 consonant … 1 dissonant
- broth.warmth: 0 cold, bright … 1 warm, dark
- broth.texture: 0 organic, acoustic, homely … 1 electronic, digital, cosmic (what the room talks about: rain and tea, or code and lasers)
- broth.strangeness: 0 plain … 1 surreal, playful, trippy (a good driver for modulation depth, delay and movement)
- broth.voices: 0 … 6, the number of people present
- broth.scale: the current scale, like "D:dorian". The root is the track's key (the pot's key, moved a few fifths by the track's palette), the mode follows valence (never phrygian where the pot is mostly lo-fi).

Between the room and the sound sit the macros, read through the global \`macro\`: continuous signals in 0 … 1, the musical dimensions the parts answer to, each fed from the room's signals by a fixed table, and some by the genres, each at its weight:
${MACRO_NAMES.map((m) => `- macro.${m}: ${MACROS[m].about} (from ${Object.entries(MACROS[m].from).map(([source, weight]) => (source === "genres" ? fedBy(m) : weight === 1 ? source : `${source} × ${weight}`)).join(" + ")})`).join("\n")}
The drums answer to them. When a part you add or rework answers to one of these dimensions, read the macro instead of the signal behind it, so whatever else comes to feed that macro reaches your part too.

The code also reads where the pot is on the genre map (below) through the global \`genre\`, again continuous signals that move by themselves:
- ${AXES.map((a) => `genre.${a}`).join(", ")}: the position on each axis, 0 … 1
- ${REGIONS.map((r) => `genre.${r.id}`).join(", ")}: how much each region's own parts should sound here, 0 … 1, adding up to 1. The nearest region dominates and a neighbour fades in as the pot comes closer to it.

A few helpers are globals too, so call them without declaring them (never declare them yourself, it only takes up room):
${Object.values(HELPER_DOCS).map((d) => `- ${d}`).join("\n")}

The score is global as well: the track's chords in their voicing, its melody, the readers of its groove and kit, and the moments the low end holds still (${SCORE_NAMES.join(", ")}). Every course and every figure of the library plays from it; its source is shown with the stone. Use these names without declaring them. A course that declares one itself plays its own in that course only; the library keeps the score's.

## Tracks

Like a well-sequenced mixtape, the pot plays tracks of two to seven minutes, each its own record, and how one goes into the next depends on the region. In lo-fi and ambient the old track's hats leave, then its beat stops and the keys ring on alone while everything fades, a beat or two of silence, and the next track starts, often with a few bars of keys before its drums come in (an intro). In dub techno and house the beat runs on: the old track's keys and bells leave over its last eight bars (an outro) and the new track's come in after eight bars of beat (an intro). In psy the old track ends in a breakdown that takes the beat away and a build into the next track's drop. The server plans all of it; the fade before a gap happens in every listener's engine, so the code never has to fade itself. The code reads where the track is through the global \`form\`, signals that are already scaled to the region (ambient only breathes, psy goes all the way):
- form.strip: 0 … 1, how much of the beat is taken away, in a breakdown and the build after it. Kick and bass leave with it and come back only at the drop: multiply their gain by form.strip.fmap(x => 1 - x).
- form.beat: what's left of the rest of the beat (hats, snare, stabs): 1 in a groove, low in a breakdown, coming back as the build rises.
- form.lift: 0 … 1, how far a build has come. Good for opening filters and thickening the hats.
- form.rush: lift, but only where the region builds with snare rolls and noise risers.
- form.drop: 1 at the moment of a drop, dying down over eight cycles. A crash, a fuller bass, filters wide open.
- form.gap: 1 in the last beat before a big drop, when the beat holds its breath. Mask the drums and bass with form.gap.fmap(g => g < 0.5).
- form.intro: 1 in a track's intro. After a silence form.strip is 1 there too, so the drums wait for the groove; in a mix the beat plays and palette.role and palette.bells are 3 (resting) until the groove.
- form.outro: 0 … 1, how far a track's outro has come. Into a silence form.hats is 0 and form.strip jumps to 1 halfway, so the beat stops and the keys ring on; in a mix palette.role and palette.bells are 3. Either way form.pad goes to 0 halfway.
Each part plays a role in the track, and the score gives every pattern a method per role that masks the part and sets its gain: its own level, times what the role leaves of it. .asLow(level) is the low end, kick and bass: it leaves in a breakdown, holds its breath at form.gap and stops for a kick break (the masks open and hold, times low). .asBeat(level) is the snare: it holds its breath and plays what's left of the beat (open, times form.beat). .asHats(level) is the hats: the same, times form.hats. Use them for the parts you add instead of spelling out the masks, like s("bd*4").lpf(1200).asLow(macro.drive.range(0.15, 0.5)), and call them last, since they set the gain.
Within a groove the track is arranged in blocks of 16 bars, like a house or lo-fi track. Each block can rest a layer or bring one in, read through more form signals: form.hats and form.pad (1 they play in this block, 0 they rest), form.bass (1 a busier bassline comes in), and palette.role and palette.bells, which a block can change for its 16 bars. The last bar of every block has a fill, form.fill: 1 a snare fill, 2 a kick break (the low end stops for the last two beats: mask kick and bass with form.fill.fmap(f => f !== 2)), 3 a tom fill, 4 a noise swell, 0 none. Parts you add should take part: rest them in some blocks, or give them a variant there.
Now and then a track opens with the pot's own theme, a four-bar melody the stone plays in the first block after the drop, twice, while form.theme is 1. It is what makes the pot recognisable over an evening: keep the stone's theme part, its notes and its rhythm exactly as they are; you may change how it sounds in the region the pot is in. Don't quote the melody anywhere else, and let leads you add step aside while it plays (mask them with form.theme.fmap(t => t < 0.5)).
Tracks always start, and drops always land, on a multiple of 16 cycles. The stone's sixteen-bar progression climbs back home in its second half and lands on the tonic on its first bar, so the build resolves into the drop; keep any progression you write aligned the same way. A breakdown is a good place for the keys to come forward; the pad stays at its level there, so a breakdown opens up instead of filling with pad. Every part should know what it does in a breakdown, a build and a drop; the stone shows how. New courses come in on the next section (an intro, a breakdown, an outro or a drop), never in the middle of one.

## Palettes and tides

Every track is its own record. When it starts, the server picks a palette for it, which the code reads through the global \`palette\` (signals that change on the track's first cycle). Its key and tempo come with it: broth.scale is already in the track's key and the clock already runs at its tempo.
- palette.root: the root of the current chord as a scale degree, from the track's sixteen-bar progression, which climbs back home into the drop, or from the track's own short loop, which may change chord an eighth before the bar. Use it for all harmony, like n(coloured("[0,4]".add(palette.root))) or n(coloured("<[0 2 4 7]*4>".add(palette.root))), so every part follows the track's chords; don't write progressions of your own over it. Add the root after a part's rhythm (chord.struct(...).add(palette.root)), so each note reads the chord at its own onset.
- palette.colour (an index: 0 in the key, 1 a dominant seventh, 2 a minor seventh, 3 a major seventh): a chord of the track's own loop may sit outside the key, like V7 in minor. Pass every pitched part through coloured(...), last, just inside n(...), so its chord tones get the sharps and flats the chord asks for.
- palette.chordBars: how many bars the current chord holds from this bar, up to the next even bar, and 0 where it carries on from the bar before. A part that holds its chord until it changes plays only where it is above 0 and lasts that long, like the stone's pad: .mask(palette.chordBars.fmap(b => b > 0)).clip(palette.chordBars).
- palette.voicing (0 … 6), palette.keys (0 … 5, which instrument plays the chords; 5 is the moody square of regions.moody), palette.role (0 comping, 1 arpeggios, 2 held chords, 3 resting for the whole track), palette.octave (-1, 0, 1), palette.bells (0 scattered harp notes, 1 a Rhodes motif, 2 a nylon guitar motif, 3 none), palette.motif (0 … 3), palette.line (the track's own eight-bar melody as scale degrees of the key, -99 for a rest, varied a little from block to block; read it with .segment(8) and mask out the rests), palette.bellLine (the bells' answer to it, read the same way), palette.prog (0 … 4, which progression: 0 … 3 wander over sixteen bars, 4 is the track's own short loop of two to four chords, which a track in lo-fi mostly plays), palette.loop and palette.figure (the seeds of the track's own loop and figures; only to read).
- palette.groove (0 laid-back, 1 boom-bap, 2 skipping, 3 broken): how the track moves. The ghost notes and hats have one figure per groove, chosen with palette.groove.pick([...]); a part you add with a rhythm of its own should follow it the same way.
- The track's own figures, two bars long, written for its groove: palette.comp (the keys' comping on eighths: 0 rest, 1 a chord on the eighth, 2 a sixteenth after it), palette.arp (the keys' arpeggio on eighths, steps over the chord's root, -99 for a rest; read it with .segment(8) and mask out the rests), palette.ring (0 … 1, how long the keys ring out), palette.kick (0 or 1 on sixteenths, never on the snare's two and four), palette.low and palette.lowLate (the bass on eighths, and the notes a sixteenth after their eighth: a step over the root, -99 for a rest). Read them with .segment(8) or .segment(16), like the stone does; the bass and the comping lock to the kick. palette.swing (0 … 2, nearly straight to heavy) is the swing swung() gives every drum part; palette.kit (0 dusty, 1 deep, 2 tight) tunes the drums, like .speed(palette.kit.fmap(k => [1, 0.88, 1.08][k])).
- The track's own drum kit (palette.drums, 0 … 7): play its samples with palette.kickSound, palette.snareSound and palette.hatSound (sample names like "gretsch:2", as a signal: s(palette.snareSound.struct("~ ~ x ~ ~ ~ x ~"))), at palette.kickLevel, snareLevel and hatLevel (multiply the gain by them; they even the kits out). The melody style keeps its 808.
- The track's own sound, so it sounds like another record: palette.wow (0 … 1, how far the keys and bass wobble), palette.bright (0 … 1, how open the keys' filters are), palette.bassTone (0 a round sine, 1 a warm triangle, 2 a short pluck), palette.motifSound (0 the palette's bells, 1 a flute, 2 a muted guitar), palette.vinyl (0 … 1, how much crackle and dust). A pot with an accent also has palette.voice (0 none, else its own voice singing the melody now and then, per VOICES: 1 koto, 2 harp, 3 muted trumpet, 4 ney, 5 marimba, 6 pan flute) and palette.space (-1 … 1, a smaller and drier or a larger and wetter room; wet() and wide() follow it). Keep what they change small; they only colour the genre.
- palette.fifths (-1 … 2, the track's key against the pot's) and palette.tempo (about 0.94 … 1.06, against the region's): only to read, the key and the clock already follow them.
- palette.day and palette.season: the phases (0 … 1) of two slow tides, a day of 20 hours and a season of 19 days, which lean which palettes come up. Use them sparingly, for very slow colour.
In the stone each choice is a masked layer, like .mask(palette.keys.fmap(k => k === 2)). The point is that no single sound plays for more than a track or two: when you add a part that would play all the time, give it variants that follow the palette, or let it rest when the palette rests.

## Styles

Above the palette sits a style, which the tides lean towards over days: three ways of treating the same music at any tempo, read as weights through the global \`style\` (style.tape, style.melody, style.gen, adding up to 1):
- tape: everything wobbles a little in pitch (.vib with style.tape driving .vibmod), saturated (.shape), dull and dusty, with a short worn motif that keeps coming back. Nostalgic.
- melody: clean and dry, a drum machine (808 samples) instead of the dusty kit, and a composed lead line over eight bars with a phrase, an answer, a climb and the way home. The tune carries the music.
- gen (generative): cool and metallic, odd FM ratios, clicks and blips in euclidean and polymetric rhythms that change from bar to bar; the keys, pad and hats thinned out. Rhythm and timbre carry the music, not harmony.
Treat the style as the most important colour after the region: when you add or rework a part, give it the treatment of the style that leads now, driven by its weight, so it changes along when the style does.

Use .range(lo, hi) to map a 0 … 1 signal onto a control, and .fmap(x => ...) for thresholds or curves, as the current code does. The broth already moves things continuously: the mode follows valence, and energy nudges the tempo a little. Your rewrites are for what signals can't do: new parts, new rhythms, new timbres, new progressions.

## The genre map

Over five to ten minutes, the room also moves the pot across a map of genres, from ambient and lo-fi at home to progressive psy at the far edge. Each brief tells you which region the pot is in and which one it is drifting towards. Your course should sound like that region, and move towards it gradually: a course near the border borrows from both, and never jumps more than one step of the way in one course. The tempo glides to each region's own BPM by itself, so never set it. A cycle is always one bar of four beats: a four-on-the-floor kick is s("bd*4"), eighth-note hats are s("hh*8").

${REGIONS.map((r) => `- ${r.name} (${r.bpm} BPM, genre.${r.id}): ${r.character} Chords and leads: ${r.synth}`).join("\n")}

These are directions, not presets: build them from the parts already playing where you can, so the music turns into the next region instead of being swapped for it. The chord and lead parts carry a region more than the drums do: the comping figure, how often the chord changes, the envelope and the timbre. Every region has a figure of its own whose gain follows its weight, like .gain(part(genre.dubTechno, 0.09)), so the pot already slides between them by itself. Whether a genre's layers play at all is the track's choice, not the weight: psychill's push kick plays where palette.pulse is 2 (the course's kick where it is 0, or 1 for a heavier one), its clap or rim on three where palette.backbeat is 1 (the course's snare where it is 0), its shakers and hand drums where palette.perc is 1, 2 or 3 (the room's tabla where it is 0), its rolling bass where palette.bassRoll is 1 (the course's bass figure where it is 0, in long, deep notes where it is 2), its lead where palette.lead is 1, downtempo's moody square where palette.keys is 5, deep house's four on the floor where palette.pulse is 5, its clap on two and four where palette.backbeat is 3, its open hats where palette.perc is 5, its offbeat bass where palette.bassRoll is 4 and its 3-3-2 stabs where palette.role is 4, dub techno's stab where palette.keys is 7 (its four on the floor, open hats and long bass are the same settings, muffled and quieter by its weight), soft IDM's clicks where palette.perc is 6 and its glass phrase where palette.lead is 2 (psychill's lead plays only where it is 1), progressive psy's roller where palette.bassRoll is 5 and its arpeggio where palette.lead is 3 (its four on the floor and open hats are the same settings, tighter by its weight), the keys rest where palette.chords is 1, and the pad plays in full where palette.pad is 0, as a quiet bed where it is 1 and not at all where it is 2; keep those masks, so a track on a border stays one record. Lo-fi's keys are written out in the course; the others live in a fixed library that the course plays through the global \`regions\` (${REGION_PART_NAMES.map((p) => `regions.${p} for ${REGIONS.find((r) => r.id === REGION_PARTS[p].region)?.name}`).join(", ")}). The brief shows the library's source for the regions near the pot. To rework one, declare it in the course as a const of the same name (it leans on the score: root, chord, open, hold, over, line, sung and the rest) and play that in place of regions.<name> in the final stack. Leave the figures of distant regions as regions.<name>, so the course stays short. Your work is to make those figures better and less repetitive where the pot is: rework the figure of the region it is in or drifting towards, give it more variations over more bars, or move another part (the bass, the pad, the bells) towards that region.

## House rules

- Evolve, never replace. Change two or three elements per course: add or remove a part, rework a rhythm, a progression or a timbre, rewire which broth signal drives what. When the pot is moving into another region, change three or four, so listeners clearly hear it go somewhere, and make one of them the rhythm or timbre of a chord or lead part. Return only the parts you change; the rest stays exactly as it is, comments included.
- Keep the long form. People listen for hours, and a one-bar loop that repeats unchanged gets tiring within minutes. Progressions, sections and breaks that span 16 or 32 cycles stay at least that long; a part you add varies over many cycles too, with <...> alternations, slowed patterns (/8) or masks.
- Read the broth; never hard-code what it controls. Every pitched part uses n(...).scale(broth.scale), never note names or a literal scale, so the key and mood stay in charge. Never set the tempo (no setcps or cpm) or the master volume (no postgain).
- Keep the key unless the room gives you a real reason to move. Move it through the key field, never in the code.
- Keep the mix gentle: a gain of 0.7 at most per part, and the overall loudness close to the current code's. When you add a part, make room for it. Validation measures the summed gain of everything sounding at once and refuses courses that are too loud.
- The course must never fall silent, even when the room is empty and low (every broth value at its minimum).
- Plain code only: const and let, arrow functions, method chains, arrays with .map. No loops, no classes, no new, no async, no string building, no other globals. The code is a row of top-level const declarations, one name each, and ends with the pattern to play, usually stack(...). The whole course stays under ${MAX_CODE_LENGTH} characters.
- Only these functions and methods: ${[...CALLABLE].join(", ")}. Also the signals sine, cosine, saw, square, tri, rand, perlin and silence, and Math.
- Only these sounds. Synths: ${SYNTHS.join(", ")}. Samples (pick one with "name:index" or .n()): ${SAMPLES.join(", ")}.
- Sampled instruments, pitched like a synth with n(...).scale(broth.scale), evened out in level so a gain means the same as on the piano: ${Object.entries(INSTRUMENTS).map(([name, i]) => `${name} (${i.about})`).join(", ")}.
- Drum machines, played with .bank(name) on their drum names, like s("bd ~ sd ~").bank("RolandTR909"), evened out to the 808 kit; each has only the names listed: ${Object.entries(DRUM_MACHINES).map(([name, m]) => `${name} (${m.about}: ${m.sounds.join(" ")})`).join(", ")}. A track's whole kit comes from one machine, or from the samples above; a new sound is a colour, so give it to one part at a time and let it come and go with the palette, not play all evening.
- Control limits: ${Object.entries(LIMITS).map(([k, [lo, hi]]) => `${k} ${lo} to ${hi}`).join(", ")}. Notes between C1 and C8: the lowest a bass or sub may go is C1, so write a sub in octave 1 ("g1", not "g0"), and with a scale count where the lowest degree lands after any octave shift. A note outside the range is moved by whole octaves before it plays, so it never sounds where you wrote it.

## The room

${rules}

## What to return

- parts: each part you add or change, as a whole top-level declaration (const name = ...), with a // comment line above it when you want a new comment. A part with the name of one in the course replaces it, keeping the old comment unless you give one; a part with a new name is placed after the last part it uses. Leave out every part you keep as it is.
- remove: the names of the parts you take out. Take them out of the final pattern too.
- final: the final pattern, usually stack(...), complete, even when it hasn't changed.
- key: the pot's key after this course, usually the same as now.
- note: the recipe note, one short lowercase line in English that says what changed and why, as it will appear on the recipe card, like "moved to D, the room went quiet and reflective" or "a soft shaker for the rain talk". At most 90 characters.`;

const stoneSection = (stone: string) => `## The score, the drums and the stone

The score, which the stone, the library and every course play from as globals:

\`\`\`js
${SCORE}
\`\`\`

The drums, a library the stone plays as drums.<name>. To rework one, declare it in the course under its own name and play that in place of drums.<name> in the final stack:

\`\`\`js
${DRUM_PART_NAMES.map(drumSource).join("\n\n")}
\`\`\`

The stone is the base course, the one the pot plays when it is lit and whenever the room has been empty for a while. Every course grows out of it, a few parts at a time, so the brief gives the course playing now as the parts in which it differs from the stone: the parts it has changed or added, the stone's parts it has taken out, and its final pattern. Every part the brief doesn't list is exactly as here, comments included.

\`\`\`js
${stone}
\`\`\``;

const Draft = z.object({
  parts: z.array(z.string()),
  remove: z.array(z.string()),
  final: z.string(),
  key: z.enum(KEYS),
  note: z.string(),
});
type Draft = z.infer<typeof Draft>;

type Brief = {
  tides: Tides;
  form: Section[];
  cycle: number;
  code: string;
  stone: string;
  key: string;
  broth: Broth;
  ingredients: Ingredient[];
  digest: string;
  recipe: string[];
  map: PotMap;
  cps: number;
  reason: string;
};

export type Write = (brief: string, failed?: { draft: Draft; problems: string[] }) => Promise<Draft | null>;

export function sonnetWrite(client: Anthropic, source: Pick<Source, "about" | "rules">, stone: string): Write {
  const system = systemFor(source);
  const withStone = stoneSection(stone);
  return async (brief, failed) => {
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: [{ type: "text", text: brief, cache_control: { type: "ephemeral" } }] },
    ];
    if (failed)
      messages.push(
        { role: "assistant", content: JSON.stringify(failed.draft) },
        {
          role: "user",
          content: `That course was refused by validation:\n${failed.problems.map((p) => `- ${p}`).join("\n")}\n\nFix these and return your changes again, against the course playing now. This answer replaces your last one, so give every part you still want changed, not only the fixed ones.`,
        },
      );
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        { type: "text", text: system },
        { type: "text", text: withStone, cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      messages,
      output_config: { format: betaZodOutputFormat(Draft), effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    logUsage(failed ? "course retry" : "course", response.model, response.usage);
    if (response.stop_reason !== "end_turn") {
      console.warn(`course rewrite stopped early: ${response.stop_reason}`);
      return null;
    }
    return response.parsed_output;
  };
}

type Kitchen = {
  present: () => number;
  tides: () => Tides;
  homeKey: () => string;
  form: () => Section[];
  cycle: () => number;
  broth: () => Broth;
  map: () => PotMap;
  cps: () => number;
  ingredients: () => Ingredient[];
  digest: () => string;
  current: () => { code: string; key: string; note: string; isStone: boolean };
  stone: string;
  recipe: () => string[];
  validate: (code: string, key: string) => Promise<Verdict>;
  serve: (code: string, note: string, key: string) => void;
  now: () => number;
};

export class LiveCoder {
  private nextAt: number;
  private lastAt: number;
  private brothAtLast: Broth;
  private regionAtLast: string;
  private ingredientsAtLast: Set<string>;
  private calmSince: number | undefined;
  private emptySince: number | undefined;
  private lastCheck: number;
  private cooking = false;
  private timer: NodeJS.Timeout;

  constructor(private write: Write | undefined, private scheduled: boolean, private kitchen: Kitchen) {
    const t = kitchen.now();
    this.lastAt = this.lastCheck = t;
    this.nextAt = t + interval();
    this.brothAtLast = { ...kitchen.broth() };
    this.regionAtLast = kitchen.map().region;
    this.ingredientsAtLast = this.noticed();
    if (!write) console.log("no Anthropic credentials found, course rewrites are off");
    this.timer = setInterval(() => this.check(), CHECK_MS);
  }

  close() {
    clearInterval(this.timer);
  }

  private check() {
    const t = this.kitchen.now();
    const elapsed = t - this.lastCheck;
    this.lastCheck = t;
    if (this.kitchen.present() === 0) {
      this.nextAt += elapsed;
      this.emptySince ??= t;
      if (!this.kitchen.current().isStone && t - this.emptySince >= EMPTY_TO_STONE_MS) {
        this.kitchen.serve(this.kitchen.stone, "back to the stone, the room emptied", this.kitchen.homeKey());
        this.served(t);
      }
      return;
    }
    this.emptySince = undefined;
    if (!this.write || this.cooking || !this.scheduled) return;
    const shift = distance(this.kitchen.broth(), this.brothAtLast);
    if (t >= this.nextAt) {
      if (this.calm(shift) && t - this.lastAt < CALM_MAX_MS) {
        if (this.calmSince === undefined) console.log("the room is calm, the current course plays on");
        this.calmSince ??= t;
        return;
      }
      void this.cook("it's time for the next course");
    } else if (t - this.lastAt < SHIFT_MIN_MS) return;
    else if (this.kitchen.map().region !== this.regionAtLast)
      void this.cook(`the pot has moved into ${this.kitchen.map().region} territory`);
    else if (shift > SHIFT_DISTANCE) void this.cook("the room's mood has shifted a lot since the last course");
  }

  async cook(reason: string) {
    if (!this.write || this.cooking) return;
    this.cooking = true;
    const k = this.kitchen;
    const current = k.current();
    const brief = writeBrief(k.now(), {
      tides: k.tides(),
      form: k.form(),
      cycle: k.cycle(),
      code: current.code,
      stone: k.stone,
      key: current.key,
      broth: k.broth(),
      ingredients: k.ingredients(),
      digest: k.digest(),
      recipe: k.recipe(),
      map: k.map(),
      cps: k.cps(),
      reason,
    });
    try {
      let failed: { draft: Draft; problems: string[] } | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        const draft = await this.write(brief, failed);
        if (!draft) break;
        const note = draft.note.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120) || "a new course";
        const spliced = splice(current.code, draft);
        const verdict = spliced.ok ? await k.validate(spliced.code, draft.key) : spliced;
        if (spliced.ok && verdict.ok) {
          const changed = `${draft.parts.length} parts changed${draft.remove.length ? `, ${draft.remove.length} removed` : ""}`;
          console.log(
            `course: ${note} (key ${draft.key}, ${changed}, ${verdict.eventsPerCycle.toFixed(0)} events per cycle, peak ${verdict.peakLevel.toFixed(2)})`,
          );
          k.serve(spliced.code, note, draft.key);
          return;
        }
        const problems = verdict.ok ? [] : verdict.problems;
        console.warn(`course refused (${note}): ${problems.join("; ")}`);
        failed = { draft, problems };
      }
      console.warn("no usable course this time, the current one keeps playing");
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        console.error(`course rewrites are off: ${err.message}`);
        this.write = undefined;
      } else if (err instanceof Anthropic.APIError) {
        console.warn(`course rewrite failed (${err.status ?? "network"}), the current course keeps playing: ${err.message}`);
      } else {
        console.error("course rewrite failed", err);
      }
    } finally {
      this.served(k.now());
      this.cooking = false;
    }
  }

  private served(t: number) {
    this.lastAt = t;
    this.nextAt = t + interval();
    this.brothAtLast = { ...this.kitchen.broth() };
    this.regionAtLast = this.kitchen.map().region;
    this.ingredientsAtLast = this.noticed();
    this.calmSince = undefined;
  }

  private calm(shift: number) {
    if (shift >= CALM_DISTANCE || this.kitchen.map().region !== this.regionAtLast) return false;
    return [...this.noticed()].every((name) => this.ingredientsAtLast.has(name));
  }

  private noticed() {
    const t = this.kitchen.now();
    return new Set(this.kitchen.ingredients().filter((i) => ingredientWeightAt(i, t) > INGREDIENT_NOTICED).map((i) => i.name));
  }
}

const interval = () => COURSE_MIN_MS + Math.random() * (COURSE_MAX_MS - COURSE_MIN_MS);

function distance(a: Broth, b: Broth) {
  return Math.max(
    Math.abs(a.valence - b.valence) / 2,
    Math.abs(a.energy - b.energy),
    Math.abs(a.density - b.density),
    Math.abs(a.tension - b.tension),
    Math.abs(a.warmth - b.warmth),
    Math.abs(a.texture - b.texture),
  );
}

function writeBrief(t: number, b: Brief) {
  const r = (x: number) => Math.round(x * 100) / 100;
  const ingredients = b.ingredients
    .map((i) => ({ name: i.name, weight: r(ingredientWeightAt(i, t)), hint: i.musicalHint }))
    .filter((i) => i.weight > INGREDIENT_NOTICED)
    .slice(0, 6);
  const broth = Object.fromEntries(Object.entries(b.broth).map(([k, v]) => [k, r(v)]));
  const share = Math.round(b.map.share * 100);
  const bpm = Math.round(b.cps * 60 * BEATS_PER_CYCLE);
  return [
    `Why now: ${b.reason}.`,
    `On the genre map: ${share}% ${b.map.region}, ${100 - share}% ${b.map.towards}. Position: ${JSON.stringify(
      Object.fromEntries(Object.entries(b.map.position).map(([k, v]) => [k, r(v)])),
    )}. The tempo is ${bpm} BPM right now, a cycle lasts ${(1 / b.cps).toFixed(2)} s.`,
    describeTrack(b.form, b.cycle, b.cps, b.tides),
    `The broth now: ${JSON.stringify(broth)}, so broth.scale is "${scaleFor(trackKey(b.key, paletteAt(b.form, b.cycle).fifths), b.broth.valence, weightsAt(b.map.position), paletteAt(b.form, b.cycle).parent, paletteAt(b.form, b.cycle).mode)}". The pot's key is ${b.key}, this track's ${trackKey(b.key, paletteAt(b.form, b.cycle).fifths)}.`,
    `In the pot: ${ingredients.length ? JSON.stringify(ingredients) : "nothing yet"}`,
    `The last recipe notes, oldest first:\n${b.recipe.map((n) => `- ${n}`).join("\n") || "- the stone"}`,
    b.digest,
    describeCourse(b.code, b.stone),
    nearbyFigures(b),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function describeCourse(code: string, stone: string) {
  const size = `${code.length} characters, the limit is ${MAX_CODE_LENGTH}`;
  if (code === stone) return `The course playing now is the stone, unchanged (${size}).`;
  const d = difference(stone, code);
  const listed = d && [...d.parts, d.final].join("\n\n");
  if (!d || !listed || listed.length > code.length * DIFFERENCE_SHARE)
    return `The course playing now (${size}):\n\`\`\`js\n${code}\n\`\`\``;
  return [
    `The course playing now is the stone with these changes (${size}).`,
    d.parts.length ? `Its parts that differ from the stone's or are new, in the course's order:\n\`\`\`js\n${d.parts.join("\n\n")}\n\`\`\`` : "It has the stone's parts as they are.",
    d.remove.length ? `The stone's parts it has taken out: ${d.remove.join(", ")}.` : "",
    `Its final pattern:\n\`\`\`js\n${d.final}\n\`\`\``,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function nearbyFigures(b: Brief) {
  const near = REGIONS.filter((r) => r.name === b.map.region || r.name === b.map.towards).map((r) => r.id);
  const figures = REGION_PART_NAMES.filter((p) => near.includes(REGION_PARTS[p].region) && b.code.includes(`regions.${p}`));
  if (!figures.length) return "";
  return `From the library, the figures of the regions near the pot, which the course plays as regions.<name>:\n\`\`\`js\n${figures.map(partSource).join("\n\n")}\n\`\`\``;
}

function describeTrack(form: Section[], cycle: number, cps: number, tides: Tides) {
  const now = sectionAt(form, cycle);
  const next = form.find((s) => s.cycle > cycle);
  const drop = form.find((s) => s.drop && s.cycle > cycle);
  const track = nextTrack(form, cycle);
  const minutes = (cycles: number) => (cycles / cps / 60).toFixed(1);
  const parts = [
    `This track's palette: ${describePalette(paletteAt(form, cycle))}.`,
    track ? `The next track's palette: ${describePalette(track.palette)}; it starts at cycle ${track.cycle}${track.kind === "intro" ? ` with an intro after a ${track.seam}` : track.drop ? " on a drop" : ""}.` : "",
    `The day tide is at ${tides.day.toFixed(2)}, the season at ${tides.season.toFixed(2)}; the style is ${describeStyle(styleWeights(tides))}.`,
    now ? `The track is in a ${now.kind}${now.drop ? " that started with a drop" : ""}${now.kind === "outro" ? ` into a ${now.seam}` : ""}, depth ${now.depth.toFixed(2)}.` : "The track has no plan right now.",
    blockInfo(form, cycle) ? `It is in block ${blockInfo(form, cycle)!.index + 1} of ${blockInfo(form, cycle)!.count} of the groove.` : "",
    next ? `Your course comes in at cycle ${next.cycle}, the start of the ${next.drop ? "next drop" : next.opens ? `next track's ${next.kind}` : next.kind}, in about ${minutes(next.cycle - cycle)} minutes.` : "",
    drop ? `The next drop is at cycle ${drop.cycle} (a multiple of ${FORM_ALIGN}).` : "",
  ];
  return parts.filter(Boolean).join(" ");
}
