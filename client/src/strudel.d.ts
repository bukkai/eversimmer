declare module "@strudel/web" {
  type Repl = {
    evaluate(code: string, autostart?: boolean): Promise<Pattern | undefined>;
    setCps(cps: number): void;
    stop(): void;
    scheduler: { now(): number; cps: number };
  };
  type Fraction = { valueOf(): number };
  export type Hap = {
    whole: { begin: Fraction; end: Fraction };
    value: unknown;
    hasOnset(): boolean;
    withValue(f: (value: { velocity?: number }) => unknown): Hap;
  };
  export type Pattern = {
    range(min: number, max: number): Pattern;
    queryArc(begin: number, end: number, controls?: object): Hap[];
  };
  type Trigger = (hap: Hap, deadline: number, duration: number, cps: number, t: number) => void;

  export function initStrudel(options?: {
    prebake?: () => Promise<unknown>;
    onEvalError?: (err: Error) => void;
    editPattern?: (pat: any) => Pattern;
  }): Promise<Repl>;
  export function samples(source: string): Promise<unknown>;
  export function signal(fn: (t: number) => number): Pattern;
  export function noteToMidi(note: string): number;
  export function getAudioContext(): AudioContext;
  export function loadBuffer(url: string, ctx: AudioContext): Promise<AudioBuffer>;
  export const soundMap: {
    get(): Record<string, { data: { type?: string; samples?: string[] | Record<string, string[]> } } | undefined>;
  };
  export function getSuperdoughAudioController(): { output: { destinationGain: GainNode | null } };
  export function hush(): void;
  export function initAudio(): Promise<void>;
  export function setTime(fn: () => number): void;
  export const webaudioOutput: Trigger;
  export function getTrigger(options: { getTime: () => number; defaultOutput: Trigger }): Trigger;
}

declare module "@strudel/soundfonts" {
  export function registerSoundfonts(): void;
}
