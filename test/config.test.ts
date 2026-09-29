import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { hostname } from "node:os";
import { Effect, Exit, FileSystem } from "effect";
import {
  loadConfig,
  saveConnectionConfig,
  savePlayerName,
} from "../src/config.js";
import { runWithServices } from "./services.js";

const tempRoot = FileSystem.FileSystem.use((fs) =>
  fs.makeTempDirectoryScoped({ prefix: "ma-tui-config-" }),
);

describe("configuration", () => {
  test("creates a persistent player id and applies environment overrides", async () => {
    await runWithServices(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* tempRoot;

        const env = {
          XDG_CONFIG_HOME: root,
          MUSIC_ASSISTANT_URL: "http://music.local:8095",
          MUSIC_ASSISTANT_TOKEN: "environment-token",
        };

        const first = yield* loadConfig(env);
        const second = yield* loadConfig(env);
        expect(first.sendspinPlayerId).toBe(second.sendspinPlayerId);
        expect(first.token).toBe("environment-token");
        expect(first.playerName).toBe(`${hostname()} - Music Assistant TUI`);
        expect(
          JSON.parse(yield* fs.readFileString(first.path)).sendspinPlayerId,
        ).toBe(first.sendspinPlayerId);
      }),
    );
  });

  test("saves a custom player name", async () => {
    await runWithServices(
      Effect.gen(function* () {
        const root = yield* tempRoot;
        const config = yield* loadConfig({ XDG_CONFIG_HOME: root });

        yield* savePlayerName(config.path, "Kitchen terminal");

        expect(yield* loadConfig({ XDG_CONFIG_HOME: root })).toMatchObject({
          playerName: "Kitchen terminal",
        });
      }),
    );
  });

  test("rejects a token in a broadly readable config file", async () => {
    await runWithServices(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* tempRoot;
        const directory = join(root, "music-assistant-tui");
        yield* fs.makeDirectory(directory, { recursive: true });
        yield* fs.writeFileString(
          join(directory, "config.json"),
          JSON.stringify({ token: "secret" }),
        );
        yield* fs.chmod(join(directory, "config.json"), 0o644);

        const result = yield* Effect.exit(
          loadConfig({ XDG_CONFIG_HOME: root }),
        );

        expect(Exit.isFailure(result)).toBe(true);
      }),
    );
  });

  test("saves connection settings without replacing player configuration", async () => {
    await runWithServices(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* tempRoot;
        const config = yield* loadConfig({ XDG_CONFIG_HOME: root });

        yield* saveConnectionConfig(config.path, {
          serverUrl: "http://music.local:8095",
          token: "secret",
        });

        const saved = JSON.parse(yield* fs.readFileString(config.path));
        expect(saved.serverUrl).toBe("http://music.local:8095");
        expect(saved.token).toBe("secret");
        expect(saved.sendspinPlayerId).toBe(config.sendspinPlayerId);
        expect((yield* fs.stat(config.path)).mode & 0o777).toBe(0o600);
      }),
    );
  });
});
