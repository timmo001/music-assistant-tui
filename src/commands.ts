import type { KeyEvent } from "@opentui/core";
import type { Locale } from "./i18n/index.js";
import type { PlayerProjection } from "./player.js";
import type { HelpEntry } from "./tui/helpBar.js";

export type PlayerCommandId =
  "play-pause" | "previous" | "next" | "volume-down" | "volume-up" | "mute";

interface PlayerCommandSpec {
  readonly id: PlayerCommandId;
  readonly keys: readonly string[];
  readonly keyLabel: string;
  readonly label: keyof Locale["help"];
  readonly command: (projection: PlayerProjection) => {
    readonly name: string;
    readonly args: Readonly<Record<string, unknown>>;
  } | null;
}

const playerArgs = (projection: PlayerProjection) =>
  projection.player === undefined
    ? null
    : { player_id: projection.player.player_id };

const adjustedVolume = (
  volume: number | null | undefined,
  direction: -1 | 1,
) => {
  const current = volume ?? 30;
  const step =
    current < 10 || current > 90 ? 1 : current < 30 || current > 70 ? 2 : 3;
  return Math.max(0, Math.min(100, current + direction * step));
};

export const playerCommands: readonly PlayerCommandSpec[] = [
  {
    id: "play-pause",
    keys: ["space"],
    keyLabel: "Space",
    label: "playPause",
    command: (projection) => {
      const args = playerArgs(projection);
      return args === null ? null : { name: "players/cmd/play_pause", args };
    },
  },
  {
    id: "previous",
    keys: [",", "<"],
    keyLabel: ",",
    label: "previous",
    command: (projection) => {
      const args = playerArgs(projection);
      return args === null ? null : { name: "players/cmd/previous", args };
    },
  },
  {
    id: "next",
    keys: [".", ">"],
    keyLabel: ".",
    label: "next",
    command: (projection) => {
      const args = playerArgs(projection);
      return args === null ? null : { name: "players/cmd/next", args };
    },
  },
  {
    id: "volume-down",
    keys: ["-"],
    keyLabel: "-",
    label: "volumeDown",
    command: (projection) => {
      const args = playerArgs(projection);
      return args === null
        ? null
        : {
            name: "players/cmd/volume_set",
            args: {
              ...args,
              volume_level: adjustedVolume(projection.player?.volume_level, -1),
            },
          };
    },
  },
  {
    id: "volume-up",
    keys: ["+", "="],
    keyLabel: "=",
    label: "volumeUp",
    command: (projection) => {
      const args = playerArgs(projection);
      return args === null
        ? null
        : {
            name: "players/cmd/volume_set",
            args: {
              ...args,
              volume_level: adjustedVolume(projection.player?.volume_level, 1),
            },
          };
    },
  },
  {
    id: "mute",
    keys: ["u"],
    keyLabel: "u",
    label: "mute",
    command: (projection) => {
      const args = playerArgs(projection);
      return args === null
        ? null
        : {
            name: "players/cmd/volume_set",
            args: {
              ...args,
              volume_level: projection.player?.volume_muted
                ? (projection.player.volume_level ?? 30)
                : 0,
            },
          };
    },
  },
];

export const playerCommandForKey = (
  key: Pick<KeyEvent, "name" | "sequence">,
  projection: PlayerProjection,
) => {
  const namedValue = (() => {
    switch (key.name) {
      case "space":
        return "space";
      case "comma":
        return ",";
      case "period":
        return ".";
      case "equal":
        return "=";
      case "minus":
        return "-";
    }
  })();
  const value = key.name === "space" ? "space" : key.sequence || namedValue;
  return playerCommands
    .find((command) =>
      value === undefined ? false : command.keys.includes(value),
    )
    ?.command(projection);
};

export const playerHelp = (strings: Locale): readonly HelpEntry[] =>
  playerCommands.map((command) => ({
    key: command.keyLabel,
    action: strings.help[command.label],
  }));
