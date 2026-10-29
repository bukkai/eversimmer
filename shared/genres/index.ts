import type { Region } from "../map";
import type { Preset } from "../presets";
import { ambient } from "./ambient";
import { deepHouse } from "./deepHouse";
import { downtempo } from "./downtempo";
import { dubTechno } from "./dubTechno";
import { lofi } from "./lofi";
import { progPsy } from "./progPsy";
import { psychill } from "./psychill";
import { softIdm } from "./softIdm";

export type GenreFile = { region: Region; preset: Preset };

export const GENRE_FILES: GenreFile[] = [ambient, lofi, downtempo, psychill, dubTechno, deepHouse, softIdm, progPsy];
