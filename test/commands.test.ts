import { describe, expect, test } from "bun:test";
import { playerCommandForKey, playerHelp } from "../src/commands.js";
import { en } from "../src/i18n/en.js";
import type { PlayerProjection } from "../src/player.js";
import { Player } from "../src/music-assistant/models.js";

const projection: PlayerProjection = {
  connection: { type: "connecting" },
  process: { type: "stopped" },
  player: Player.make({
    player_id: "player",
    provider: "sendspin",
    type: "player",
    name: "Terminal",
    available: true,
    enabled: true,
    playback_state: "playing",
    volume_level: 30,
    volume_muted: false,
    group_members: [],
    supported_features: [],
  }),
  title: "Track",
  elapsed: 0,
};

const key = (name: string, sequence = "") => ({ name, sequence });

describe("player commands", () => {
  test.each([
    ["comma", "", "players/cmd/previous"],
    ["period", "", "players/cmd/next"],
    ["equal", "", "players/cmd/volume_set"],
    ["minus", "", "players/cmd/volume_set"],
    ["<", "<", "players/cmd/previous"],
    [">", ">", "players/cmd/next"],
    ["+", "+", "players/cmd/volume_set"],
  ])("maps %s to %s", (name, sequence, command) => {
    expect(playerCommandForKey(key(name, sequence), projection)?.name).toBe(
      command,
    );
  });

  test("sets absolute volume and emulates mute for the playback helper", () => {
    expect(playerCommandForKey(key("equal"), projection)?.args).toEqual({
      player_id: "player",
      volume_level: 33,
    });
    expect(playerCommandForKey(key("u", "u"), projection)?.args).toEqual({
      player_id: "player",
      volume_level: 0,
    });
  });

  test("shows unshifted shortcuts", () => {
    expect(playerHelp(en).map((entry) => entry.key)).toEqual([
      "Space",
      ",",
      ".",
      "-",
      "=",
      "u",
    ]);
  });
});
