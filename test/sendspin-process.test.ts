import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect, SubscriptionRef } from "effect";
import { SendspinProcess } from "../src/sendspin/index.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe("Sendspin process", () => {
  test("passes playback configuration and owns child shutdown", async () => {
    const root = await mkdtemp(join(tmpdir(), "ma-tui-sendspin-"));
    directories.push(root);
    const fixture = join(root, "sendspin-rs-cli");
    await writeFile(
      fixture,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'sendspin-rs-cli 0.0.8\\n'
  exit 0
fi
trap 'exit 0' TERM
while :; do sleep 1; done
`,
    );
    await chmod(fixture, 0o755);

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* SendspinProcess.make(fixture, root);
          yield* service.start({
            serverUrl: "http://127.0.0.1:8095",
            playerId: "player-id",
            playerName: "Terminal",
            volume: 40,
          });
          yield* Effect.sleep("50 millis");
          const running = yield* SubscriptionRef.get(service.status);
          if (running.type !== "running")
            throw new Error("fixture did not start");
          const commandLine = yield* Effect.promise(() =>
            readFile(`/proc/${running.pid}/cmdline`, "utf8"),
          );
          const args = commandLine.split("\0").filter(Boolean).slice(2);
          yield* service.stop;
          const stopped = yield* SubscriptionRef.get(service.status);
          return { running, stopped, args };
        }),
      ),
    );

    expect(result.running.type).toBe("running");
    expect(result.stopped.type).toBe("stopped");
    expect(result.args).toEqual([
      "--server",
      "127.0.0.1:8927",
      "--client-id",
      "player-id",
      "--name",
      "Terminal",
      "--volume",
      "40",
    ]);
  });
});
