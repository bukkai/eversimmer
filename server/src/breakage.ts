const MIN_REPORTERS = 2;
const MIN_SHARE = 0.25;
const KEPT_COURSES = 20;
export const MAX_ERROR_LENGTH = 200;

export class Breakage {
  private reports = new Map<string, Set<string>>();
  private fallen = new Set<string>();

  report(course: string, who: string, listening: number) {
    let reporters = this.reports.get(course);
    if (!reporters) {
      this.reports.set(course, (reporters = new Set()));
      if (this.reports.size > KEPT_COURSES) this.reports.delete(this.reports.keys().next().value!);
    }
    const fresh = !reporters.has(who);
    reporters.add(who);
    const enough = reporters.size >= Math.max(MIN_REPORTERS, Math.ceil(listening * MIN_SHARE));
    const fallBack = enough && !this.fallen.has(course);
    if (fallBack) this.fallen.add(course);
    return { fresh, reporters: reporters.size, fallBack };
  }

  broke(course: string) {
    return this.fallen.has(course);
  }
}
