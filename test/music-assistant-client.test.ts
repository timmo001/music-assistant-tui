import { afterEach, describe, expect, test } from "bun:test";
import { Effect, SubscriptionRef } from "effect";
import { MusicAssistantClient } from "../src/music-assistant/index.js";
import { Player } from "../src/music-assistant/models.js";

const servers: Bun.Server<undefined>[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

const startServer = () => {
  const server = Bun.serve({
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response("upgrade required", { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(
          JSON.stringify({
            server_id: "server-1",
            server_version: "2.7.0",
            schema_version: 33,
            min_supported_schema_version: 28,
            base_url: "http://127.0.0.1",
            homeassistant_addon: false,
            onboard_done: true,
            name: "Test server",
            status: "running",
            internal_url: "http://127.0.0.1",
            external_url: null,
            has_remote_access: false,
          }),
        );
      },
      message(socket, raw) {
        const command = JSON.parse(String(raw));
        if (command.command === "streamed") {
          socket.send(
            JSON.stringify({
              message_id: command.message_id,
              result: ["first"],
              partial: true,
            }),
          );
          socket.send(
            JSON.stringify({
              message_id: command.message_id,
              result: ["second"],
            }),
          );
          return;
        }
        socket.send(
          JSON.stringify({
            message_id: command.message_id,
            result:
              command.command === "auth"
                ? true
                : command.command === "players/all" ||
                    command.command === "player_queues/all"
                  ? []
                  : null,
          }),
        );
      },
    },
  });
  servers.push(server);
  return `http://127.0.0.1:${server.port}`;
};

describe("Music Assistant client", () => {
  test("authenticates, loads initial state, and accumulates partial results", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* MusicAssistantClient.connect({
            serverUrl: startServer(),
            token: "token",
          });
          const snapshot = yield* SubscriptionRef.get(client.state);
          const streamed = yield* client.command("streamed");
          return { snapshot, streamed };
        }),
      ),
    );

    expect(result.snapshot.connection.type).toBe("authenticated");
    expect(result.snapshot.players.size).toBe(0);
    expect(result.streamed).toEqual(["first", "second"]);
  });

  test("accepts nullable current-media titles", () => {
    expect(() =>
      Player.make({
        player_id: "player",
        provider: "sendspin",
        type: "player",
        name: "Terminal",
        available: true,
        enabled: true,
        playback_state: "idle",
        group_members: [],
        supported_features: [],
        current_media: {
          uri: "media://unknown",
          title: null,
          media_type: "track",
        },
      }),
    ).not.toThrow();
  });
});
