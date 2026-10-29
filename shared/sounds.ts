export const SOUNDFONT_URL = "https://felixroos.github.io/webaudiofontdata/sound";
export const DRUM_MACHINES_URL = "https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json";

type Instrument = { about: string; level: number };

export const INSTRUMENTS: Record<string, Instrument> = {
  gm_epiano1: { about: "a mellow Rhodes-like e-piano; lo-fi, downtempo, deep house chords", level: 0.41 },
  gm_vibraphone: { about: "a soft vibraphone with a long ring; lo-fi, downtempo", level: 0.41 },
  gm_marimba: { about: "a short wooden mallet; downtempo, psychill, soft IDM figures", level: 0.54 },
  gm_kalimba: { about: "a thumb piano, plucked and bright; lo-fi, ambient, psychill", level: 0.53 },
  gm_music_box: { about: "a tiny music box; ambient and lo-fi, sparse, high up", level: 0.33 },
  gm_koto: { about: "a plucked koto; psychill, ambient, a few notes at a time", level: 0.52 },
  gm_acoustic_guitar_nylon: { about: "a nylon-string guitar; lo-fi and downtempo chords and licks", level: 0.38 },
  gm_electric_guitar_jazz: { about: "a warm jazz guitar; lo-fi comping", level: 0.43 },
  gm_acoustic_bass: { about: "an upright bass; lo-fi and jazzy downtempo", level: 0.73 },
  gm_fretless_bass: { about: "a round fretless bass; downtempo, dub, psychill", level: 0.27 },
  gm_synth_bass_1: { about: "an analog synth bass; deep house, progressive psy", level: 0.4 },
  gm_drawbar_organ: { about: "a drawbar organ; deep house and dub techno chords, filtered", level: 0.65 },
  gm_string_ensemble_1: { about: "a string section; ambient and downtempo swells, long notes", level: 0.43 },
  gm_cello: { about: "a solo cello; ambient, slow lines", level: 0.59 },
  gm_pizzicato_strings: { about: "plucked strings; downtempo and soft IDM figures", level: 0.4 },
  gm_orchestral_harp: { about: "a harp; ambient arpeggios", level: 0.29 },
  gm_choir_aahs: { about: "a choir singing aah; ambient and psychill, held chords", level: 0.67 },
  gm_voice_oohs: { about: "soft ooh voices; ambient, lo-fi, held chords", level: 0.34 },
  gm_flute: { about: "a concert flute; downtempo, psychill leads", level: 0.5 },
  gm_pan_flute: { about: "a breathy pan flute; psychill, downtempo leads", level: 0.51 },
  gm_shakuhachi: { about: "a breathy bamboo flute; ambient, psychill, slow phrases", level: 0.35 },
  gm_muted_trumpet: { about: "a muted trumpet; lo-fi and jazzy downtempo, short phrases", level: 0.48 },
  gm_pad_warm: { about: "a warm analog pad; ambient, dub techno, held chords", level: 0.53 },
  gm_pad_halo: { about: "an airy, glassy pad; ambient, psychill", level: 0.31 },
  gm_pad_bowed: { about: "a bowed glass pad; ambient, slow", level: 0.55 },
};

type Machine = { about: string; sounds: string[]; level: number };

export const DRUM_MACHINES: Record<string, Machine> = {
  RolandTR909: { about: "the house and techno kit; deep house, dub techno, progressive psy", sounds: ["bd", "cp", "cr", "hh", "ht", "lt", "mt", "oh", "rd", "rim", "sd"], level: 0.57 },
  RolandTR707: { about: "a bright 80s kit, a lighter house", sounds: ["bd", "cb", "cp", "cr", "hh", "ht", "lt", "mt", "oh", "rim", "sd", "tb"], level: 0.4 },
  RolandTR606: { about: "a thin, ticking analog kit; minimal, soft IDM", sounds: ["bd", "cr", "hh", "ht", "lt", "oh", "sd"], level: 0.62 },
  RolandCompurhythm78: { about: "the CR-78, soft and vintage; lo-fi, psychill, downtempo", sounds: ["bd", "cb", "hh", "misc", "oh", "perc", "sd", "tb"], level: 0.5 },
  KorgMinipops: { about: "an organ-top rhythm box, small and gentle; lo-fi, ambient", sounds: ["bd", "hh", "misc", "oh", "sd"], level: 0.58 },
  LinnDrum: { about: "punchy 80s sampled drums; downtempo, house", sounds: ["bd", "cb", "cp", "cr", "hh", "ht", "lt", "mt", "oh", "perc", "rd", "rim", "sd", "sh", "tb"], level: 0.38 },
  EmuSP12: { about: "a gritty 12-bit sampler kit; lo-fi boom-bap", sounds: ["bd", "cb", "cp", "cr", "hh", "ht", "lt", "misc", "mt", "oh", "perc", "rd", "rim", "sd"], level: 0.54 },
  AkaiMPC60: { about: "a warm MPC kit; lo-fi, downtempo", sounds: ["bd", "cp", "cr", "hh", "ht", "lt", "misc", "mt", "oh", "perc", "rd", "rim", "sd"], level: 0.46 },
};

export function machineOf(s: string) {
  const [bank, sound] = s.split("_");
  return Object.hasOwn(DRUM_MACHINES, bank) && sound !== undefined ? { bank, sound } : undefined;
}

export function levelOf(s: string, bank?: string) {
  if (bank) return DRUM_MACHINES[bank]?.level ?? 1;
  const machine = machineOf(s);
  if (machine) return DRUM_MACHINES[machine.bank].level;
  return INSTRUMENTS[s]?.level ?? 1;
}
