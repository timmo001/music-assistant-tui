import { StyledText, fg, bold } from "@opentui/core";
import type { TextChunk } from "@opentui/core";
import type { Theme } from "../theme.js";

/**
 * Format the header bar as a single-line `StyledText`.
 *
 * Preceding breadcrumb parts are muted and the final part is accented.
 */
export function formatHeaderBar(
  theme: Theme,
  titleParts: readonly string[],
): StyledText {
  const chunks: TextChunk[] = [];
  if (titleParts.length <= 1) {
    chunks.push(bold(fg(theme.accent)(titleParts[0] ?? "")));
  } else {
    chunks.push(fg(theme.fgMuted)(titleParts.slice(0, -1).join(" › ")));
    chunks.push(fg(theme.fgSubtle)(" › "));
    chunks.push(bold(fg(theme.accent)(titleParts.at(-1) ?? "")));
  }
  return new StyledText(chunks);
}
