import raw from "./takes.json";
import type { TakeFile } from "./types";

export const TAKES = raw as Record<string, TakeFile>;
