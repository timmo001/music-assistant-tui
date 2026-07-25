import { describe, expect, test } from "bun:test";
import type { MusicAssistantSnapshot } from "../src/music-assistant/client.js";
import { Player } from "../src/music-assistant/models.js";
import { PlayerQueue } from "../src/music-assistant/models.js";
import { projectPlayer } from "../src/player.js";

describe("player projection", () => {
  test("uses Music Assistant as the metadata authority", () => {
    const player = Player.make({
      player_id: "local-player",
      provider: "sendspin",
      type: "player",
      name: "Terminal",
      available: true,
      enabled: true,
      playback_state: "playing",
      group_members: [],
      supported_features: [],
      current_media: {
        uri: "library://track/1",
        title: "Track",
        artist: "Artist",
        album: "Album",
        media_type: "track",
        duration: 180,
        elapsed_time: 12,
      },
    });
    const snapshot: MusicAssistantSnapshot = {
      connection: {
        type: "authenticated",
        server: {
          server_id: "server",
          server_version: "2.7.0",
          schema_version: 33,
          min_supported_schema_version: 28,
          homeassistant_addon: false,
          onboard_done: true,
          status: "running",
          has_remote_access: false,
        },
      },
      players: new Map([[player.player_id, player]]),
      queues: new Map(),
    };

    const projection = projectPlayer(
      snapshot,
      { type: "running", pid: 123 },
      player.player_id,
    );
    expect(projection.title).toBe("Track");
    expect(projection.artist).toBe("Artist");
    expect(projection.elapsed).toBe(12);
  });

  test("advances a playing queue from its update timestamp", () => {
    const queue = PlayerQueue.make({
      queue_id: "local-player",
      active: true,
      display_name: "Terminal",
      available: true,
      items: 1,
      state: "playing",
      elapsed_time: 10,
      elapsed_time_last_updated: 100,
      playback_speed: 1,
      shuffle_enabled: false,
      repeat_mode: "off",
      autoplay_enabled: false,
    });
    const projection = projectPlayer(
      {
        connection: { type: "connecting" },
        players: new Map(),
        queues: new Map([[queue.queue_id, queue]]),
      },
      { type: "running", pid: 123 },
      queue.queue_id,
      105,
    );
    expect(projection.elapsed).toBe(15);
  });

  test("resolves a Sendspin client through its universal player", () => {
    const player = Player.make({
      player_id: "upmusicassistanttui12345678",
      provider: "universal_player",
      type: "player",
      name: "Music Assistant TUI",
      available: true,
      enabled: true,
      playback_state: "playing",
      group_members: [],
      supported_features: [],
    });
    const queue = PlayerQueue.make({
      queue_id: player.player_id,
      active: true,
      display_name: player.name,
      available: true,
      items: 1,
      state: "playing",
      elapsed_time: 10,
      elapsed_time_last_updated: 100,
      playback_speed: 1,
      shuffle_enabled: false,
      repeat_mode: "off",
      autoplay_enabled: false,
      current_item: {
        queue_id: player.player_id,
        queue_item_id: "item-1",
        name: "Track",
        duration: 180,
        sort_index: 0,
        available: true,
      },
    });

    const projection = projectPlayer(
      {
        connection: { type: "connecting" },
        players: new Map([[player.player_id, player]]),
        queues: new Map([[queue.queue_id, queue]]),
      },
      { type: "running", pid: 123 },
      "music-assistant-tui-1234-5678",
      105,
    );

    expect(projection.player?.player_id).toBe(player.player_id);
    expect(projection.queue?.queue_id).toBe(player.player_id);
    expect(projection.title).toBe("Track");
  });
});
