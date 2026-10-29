export const COLORS = [
  "#c8553d",
  "#d99a2b",
  "#6a994e",
  "#2a9d8f",
  "#3d7bbf",
  "#8e5ea2",
  "#c95b8f",
  "#9c6644",
];

export type Person = {
  id: string;
  name: string;
  color: string;
};

export const MAX_NAME_LENGTH = 24;

export const cleanName = (name: string) =>
  name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);

export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function identityFor(name: string) {
  return { color: COLORS[hash(name.toLowerCase()) % COLORS.length] };
}
