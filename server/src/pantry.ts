import { randomUUID } from "node:crypto";
import {
  INGREDIENT_GONE_BELOW,
  ingredientWeightAt,
  type Ingredient,
} from "../../shared/types";

export type FoundIngredient = { name: string; weight: number; addedBy: string[]; musicalHint: string };

const MAX_INGREDIENTS = 12;
const MAX_CREDITS = 6;
const ONE_VOICE = 0.3;

export type PantryRules = { oneVoice: number; stack: boolean };
const PEOPLE: PantryRules = { oneVoice: ONE_VOICE, stack: true };

export class Pantry {
  readonly items: Ingredient[] = [];

  constructor(private rules: PantryRules = PEOPLE) {}

  private ceiling(credits: string[]) {
    return Math.min(1, this.rules.oneVoice * Math.max(1, credits.length));
  }

  add(found: FoundIngredient[], at: number): Ingredient[] {
    this.settle(at);
    const added: Ingredient[] = [];
    for (const f of found) {
      const existing = this.items.find((i) => i.name === f.name);
      if (existing) {
        if (this.rules.stack) existing.weight += f.weight * (1 - existing.weight);
        else existing.weight = Math.max(existing.weight, f.weight);
        existing.addedBy = [...new Set([...existing.addedBy, ...f.addedBy])].slice(-MAX_CREDITS);
        existing.weight = Math.min(existing.weight, this.ceiling(existing.addedBy));
        if (f.musicalHint) existing.musicalHint = f.musicalHint;
      } else {
        const ingredient: Ingredient = {
          id: randomUUID(),
          name: f.name,
          weight: Math.min(f.weight, this.ceiling(f.addedBy)),
          addedBy: f.addedBy.slice(0, MAX_CREDITS),
          addedAt: at,
          updatedAt: at,
          musicalHint: f.musicalHint || undefined,
        };
        this.items.push(ingredient);
        added.push(ingredient);
      }
    }
    this.items.sort((a, b) => b.weight - a.weight);
    this.items.splice(MAX_INGREDIENTS);
    return added.filter((i) => this.items.includes(i));
  }

  settle(at: number) {
    const before = this.items.length;
    for (const i of this.items) {
      i.weight = ingredientWeightAt(i, at);
      i.updatedAt = at;
    }
    const kept = this.items.filter((i) => i.weight >= INGREDIENT_GONE_BELOW);
    this.items.splice(0, this.items.length, ...kept);
    return this.items.length !== before;
  }

  names() {
    return this.items.map((i) => i.name);
  }
}

export function announce(added: Ingredient[]) {
  const names = added.map((i) => i.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const by = [...new Set(added.flatMap((i) => i.addedBy))];
  const via = by.length > 4 ? `${by.slice(0, 3).join(", ")} and others` : by.join(", ");
  return `${list} went in the pot${via ? ` (via ${via})` : ""}`;
}
