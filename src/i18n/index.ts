import { Context } from "effect";
import { en } from "./en.js";

export type { Locale } from "./types.js";

export const Strings: Context.Reference<import("./types.js").Locale> =
  Context.Reference("music-assistant-tui/Strings", { defaultValue: () => en });
