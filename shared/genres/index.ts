import type { Region } from "../map";
import type { Preset } from "../presets";
import { ambient } from "./ambient";
import { ambientTechno } from "./ambientTechno";
import { deepHouse } from "./deepHouse";
import { downtempo } from "./downtempo";
import { dubTechno } from "./dubTechno";
import { lofi } from "./lofi";
import { meditative } from "./meditative";
import { pianoAmbient } from "./pianoAmbient";
import { progPsy } from "./progPsy";
import { psychill } from "./psychill";
import { softIdm } from "./softIdm";
import { spaceAmbient } from "./spaceAmbient";

export type GenreFile = { region: Region; preset: Preset };

export const GENRE_FILES: GenreFile[] = [
  ambient, lofi, downtempo, psychill, dubTechno, deepHouse, softIdm, progPsy,
  meditative, spaceAmbient, pianoAmbient, ambientTechno,
];
