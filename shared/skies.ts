export type PretendSky = {
  name: string;
  temperature: number;
  precipitation: number;
  code: number;
  cloud: number;
  wind: number;
  gusts: number;
  day: number;
  light: number;
  visibility: number;
  fall: number;
};

export const SKIES: Record<string, PretendSky> = {
  sunny: { name: "a sunny, still day", temperature: 22, precipitation: 0, code: 0, cloud: 5, wind: 6, gusts: 12, day: 1, light: 650, visibility: 30_000, fall: 0 },
  grey: { name: "a grey, still day", temperature: 12, precipitation: 0, code: 3, cloud: 100, wind: 5, gusts: 10, day: 1, light: 110, visibility: 20_000, fall: 0 },
  drizzle: { name: "drizzle", temperature: 11, precipitation: 0.4, code: 53, cloud: 100, wind: 10, gusts: 20, day: 1, light: 80, visibility: 8000, fall: 0.5 },
  rain: { name: "rain and wind", temperature: 10, precipitation: 3, code: 63, cloud: 100, wind: 35, gusts: 55, day: 1, light: 60, visibility: 6000, fall: 2 },
  storm: { name: "a thunderstorm", temperature: 17, precipitation: 7, code: 95, cloud: 100, wind: 55, gusts: 85, day: 1, light: 40, visibility: 3000, fall: 5 },
  fog: { name: "a foggy morning", temperature: 7, precipitation: 0, code: 45, cloud: 100, wind: 3, gusts: 6, day: 1, light: 50, visibility: 400, fall: 0 },
  snow: { name: "snow", temperature: -2, precipitation: 1, code: 73, cloud: 100, wind: 12, gusts: 25, day: 1, light: 70, visibility: 2000, fall: 1 },
  night: { name: "a clear night", temperature: 9, precipitation: 0, code: 0, cloud: 5, wind: 5, gusts: 10, day: 0, light: 0, visibility: 30_000, fall: 0 },
};
