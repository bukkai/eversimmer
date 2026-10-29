import type { Person } from "../../shared/identity";
import type { ChatLine, ClientMessage, ServerMessage, Sky } from "../../shared/protocol";
import type { Lean, Tides } from "../../shared/palette";
import type { Air, Broth, Ingredient } from "../../shared/types";

export type MoodTargets = Omit<Broth, "voices">;

export interface Source {
  targets(at: number): MoodTargets;
  readonly ingredients: Ingredient[];
  settle(at: number): boolean;
  reset(): void;
  restAt(broth: Omit<Broth, "voices">): void;

  readonly about: string;
  readonly rules: string;
  digest(): string;

  tides?(at: number): Tides;
  lean?(at: number): Lean;
  air?(at: number): Air;

  sky?(at: number): Sky;

  readonly talk?: Talk;

  close?(): void;
}

export interface Talk {
  history(): ChatLine[];
  post(text: string): void;
  receive(person: Person, msg: ClientMessage, reply: (text: string) => void): boolean;
}

export type SourceContext = {
  broadcast(msg: ServerMessage): void;
  tell(name: string, text: string): void;
  now(): number;
};
