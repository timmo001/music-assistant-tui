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
    keyLabel: "<",
    label: "previous",
    command: (projection) => {
      const args = playerArgs(projection);
      return args === null ? null : { name: "players/cmd/previous", args };
    },
  },
  {
    id: "next",
    keys: [".", ">"],
    keyLabel: ">",
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
      return args === null ? null : { name: "players/cmd/volume_down", args };
    },
  },
  {
    id: "volume-up",
    keys: ["+", "="],
    keyLabel: "+",
    label: "volumeUp",
    command: (projection) => {
      const args = playerArgs(projection);
      return args === null ? null : { name: "players/cmd/volume_up", args };
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
            name: "players/cmd/volume_mute",
            args: { ...args, muted: !projection.player?.volume_muted },
          };
    },
  },
];

export const playerCommandForKey = (
  key: KeyEvent,
  projection: PlayerProjection,
) => {
  const value = key.name === "space" ? "space" : key.sequence;
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
