export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function remembered(key: string) {
  try {
    return localStorage.getItem(`eversimmer:${key}`);
  } catch {
    return null;
  }
}
export function remember(key: string, value: string) {
  try {
    localStorage.setItem(`eversimmer:${key}`, value);
  } catch {}
}
