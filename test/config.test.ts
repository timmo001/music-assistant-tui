import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";
import { loadConfig, saveConnectionConfig } from "../src/config.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe("configuration", () => {
  test("creates a persistent player id and applies environment overrides", async () => {
    const root = await mkdtemp(join(tmpdir(), "ma-tui-config-"));
    directories.push(root);
    const env = {
      XDG_CONFIG_HOME: root,
      MUSIC_ASSISTANT_URL: "http://music.local:8095",
      MUSIC_ASSISTANT_TOKEN: "environment-token",
    };

    const first = await Effect.runPromise(loadConfig(env));
    const second = await Effect.runPromise(loadConfig(env));
    expect(first.sendspinPlayerId).toBe(second.sendspinPlayerId);
    expect(first.token).toBe("environment-token");
    expect(
      JSON.parse(await readFile(first.path, "utf8")).sendspinPlayerId,
    ).toBe(first.sendspinPlayerId);
  });

  test("rejects a token in a broadly readable config file", async () => {
    const root = await mkdtemp(join(tmpdir(), "ma-tui-config-"));
    directories.push(root);
    const directory = join(root, "music-assistant-tui");
    await Bun.write(
      join(directory, "config.json"),
      JSON.stringify({ token: "secret" }),
    );
    await chmod(join(directory, "config.json"), 0o644);

    const result = await Effect.runPromiseExit(
      loadConfig({ XDG_CONFIG_HOME: root }),
    );
    expect(result._tag).toBe("Failure");
  });

  test("saves connection settings without replacing player configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "ma-tui-config-"));
    directories.push(root);
    const config = await Effect.runPromise(
      loadConfig({ XDG_CONFIG_HOME: root }),
    );

    await Effect.runPromise(
      saveConnectionConfig(config.path, {
        serverUrl: "http://music.local:8095",
        token: "secret",
      }),
    );

    const saved = JSON.parse(await readFile(config.path, "utf8"));
    expect(saved.serverUrl).toBe("http://music.local:8095");
    expect(saved.token).toBe("secret");
    expect(saved.sendspinPlayerId).toBe(config.sendspinPlayerId);
    expect((await stat(config.path)).mode & 0o777).toBe(0o600);
  });
});
