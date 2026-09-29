import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, FileSystem, SubscriptionRef } from "effect";
import { SendspinProcess } from "../src/sendspin/index.js";
import { runWithServices } from "./services.js";

const helper = `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'sendspin-rs-cli 0.0.8\\n'
  exit 0
fi
trap 'exit 0' TERM
while :; do sleep 1; done
`;

const fixtureIn = (contents: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const root = yield* fs.makeTempDirectoryScoped({
      prefix: "ma-tui-sendspin-",
    });

    const fixture = join(root, "sendspin-rs-cli");
    yield* fs.writeFileString(fixture, contents);
    yield* fs.chmod(fixture, 0o755);

    return { root, fixture };
  });

describe("Sendspin process", () => {
  test("resolves a configured helper", async () => {
    await runWithServices(
      Effect.gen(function* () {
        const { fixture } = yield* fixtureIn("#!/bin/sh\n");

        expect(yield* SendspinProcess.resolveBinary(fixture)).toBe(fixture);
      }),
    );
  });

  test("passes playback configuration and owns child shutdown", async () => {
    const result = await runWithServices(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { root, fixture } = yield* fixtureIn(helper);
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

        const commandLine = yield* fs.readFileString(
          `/proc/${running.pid}/cmdline`,
        );

        const args = commandLine.split("\0").filter(Boolean).slice(2);
        yield* service.stop;
        const stopped = yield* SubscriptionRef.get(service.status);

        return { running, stopped, args };
      }),
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

  test("stops the child when its scope closes", async () => {
    const pid = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { root, fixture } = yield* fixtureIn(helper);
          const service = yield* SendspinProcess.make(fixture, root);

          yield* service.start({
            serverUrl: "http://127.0.0.1:8095",
            playerId: "player-id",
            playerName: "Terminal",
            volume: 40,
          });
          const status = yield* SubscriptionRef.get(service.status);

          if (status.type !== "running")
            throw new Error("fixture did not start");

          return status.pid;
        }),
      ).pipe(Effect.provide(BunServices.layer)),
    );

    expect(() => process.kill(pid, 0)).toThrow();
  });
});
