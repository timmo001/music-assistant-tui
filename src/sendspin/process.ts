import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  Context,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Schema,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const SUPPORTED_VERSION = "0.0.10";

export type ProcessStatus =
  | { readonly type: "stopped" }
  | { readonly type: "starting" }
  | { readonly type: "running"; readonly pid: number }
  | { readonly type: "exited"; readonly code: number };

export class SendspinProcessError extends Schema.TaggedError<SendspinProcessError>()(
  "SendspinProcessError",
  { message: Schema.String },
) {}

export interface StartOptions {
  readonly serverUrl: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly volume: number;
}

export interface Interface {
  readonly status: SubscriptionRef.SubscriptionRef<ProcessStatus>;
  readonly start: (
    options: StartOptions,
  ) => Effect.Effect<void, SendspinProcessError>;
  readonly stop: Effect.Effect<void>;
}

export class Service extends Context.Service<Service, Interface>()(
  "@music-assistant-tui/SendspinProcess",
) {}

const commandExists = Effect.fn("SendspinProcess.commandExists")(function* (
  command: string,
) {
  if (command.includes("/")) {
    const fs = yield* FileSystem.FileSystem;

    return yield* fs.stat(command).pipe(
      Effect.map((info) => info.type === "File" && (info.mode & 0o111) !== 0),
      Effect.orElseSucceed(() => false),
    );
  }

  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  return yield* spawner
    .spawn(
      ChildProcess.make("sh", ["-c", 'command -v -- "$1"', "sh", command], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      }),
    )
    .pipe(
      Effect.flatMap((child) => child.exitCode),
      Effect.scoped,
      Effect.map((code) => Number(code) === 0),
      Effect.orElseSucceed(() => false),
    );
});

export const resolveBinary = Effect.fn("SendspinProcess.resolveBinary")(
  function* (configured?: string) {
    const candidates = [
      configured,
      "/usr/lib/music-assistant-tui/sendspin-rs-cli",
      join(process.cwd(), "dist", "sendspin-rs-cli"),
      "sendspin-rs-cli",
    ].filter((candidate) => candidate !== undefined);

    for (const candidate of candidates) {
      if (yield* commandExists(candidate)) return candidate;
    }

    return yield* new SendspinProcessError({
      message: "sendspin-rs-cli was not found; set SENDSPIN_PLAYER_BINARY",
    });
  },
);

const readVersion = Effect.fn("SendspinProcess.readVersion")(
  function* (binary: string) {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const child = yield* spawner.spawn(
      ChildProcess.make(binary, ["--version"], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore",
      }),
    );

    const [output, code] = yield* Effect.all(
      [child.stdout.pipe(Stream.decodeText(), Stream.mkString), child.exitCode],
      { concurrency: "unbounded" },
    );

    return { output: output.trim(), code: Number(code) };
  },
  Effect.scoped,
  Effect.mapError(
    (error) => new SendspinProcessError({ message: error.message }),
  ),
);

export const sendspinAddress = (serverUrl: string): string => {
  const url = new URL(serverUrl);
  const host = url.hostname.includes(":") ? `[${url.hostname}]` : url.hostname;

  return `${host}:8927`;
};

export const make = (
  configuredBinary?: string,
  stateHome = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"),
): Effect.Effect<
  Interface,
  never,
  Scope.Scope | FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const context = yield* Effect.context<
      FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
    >();

    const status = yield* SubscriptionRef.make<ProcessStatus>({
      type: "stopped",
    });

    let current: { readonly scope: Scope.Closeable } | undefined;

    const stop = Effect.gen(function* () {
      if (current !== undefined) {
        const { scope } = current;
        current = undefined;
        yield* Scope.close(scope, Exit.void);
      }

      yield* SubscriptionRef.set(status, { type: "stopped" });
    });

    yield* Effect.addFinalizer(() => stop);

    const start = Effect.fn("SendspinProcess.start")(function* (
      options: StartOptions,
    ) {
      if (current !== undefined) return;
      yield* SubscriptionRef.set(status, { type: "starting" });

      const binary = yield* resolveBinary(configuredBinary).pipe(
        Effect.tapError(() =>
          SubscriptionRef.set(status, { type: "exited", code: 127 }),
        ),
      );

      const version = yield* readVersion(binary);

      if (version.code !== 0 || !version.output.includes(SUPPORTED_VERSION)) {
        yield* SubscriptionRef.set(status, { type: "exited", code: 126 });

        return yield* new SendspinProcessError({
          message: `Expected sendspin-rs-cli ${SUPPORTED_VERSION}, received '${version.output}'`,
        });
      }

      const logPath = join(stateHome, "music-assistant-tui", "sendspin.log");
      const scope = yield* Scope.make();

      const child = yield* fs
        .makeDirectory(dirname(logPath), { recursive: true })
        .pipe(
          Effect.andThen(
            spawner.spawn(
              ChildProcess.make(
                binary,
                [
                  "--server",
                  sendspinAddress(options.serverUrl),
                  "--client-id",
                  options.playerId,
                  "--name",
                  options.playerName,
                  "--volume",
                  String(options.volume),
                ],
                {
                  stdin: "ignore",
                  stdout: "ignore",
                  stderr: "pipe",
                  killSignal: "SIGTERM",
                  forceKillAfter: "2 seconds",
                },
              ),
            ),
          ),
          Scope.provide(scope),
          Effect.tapError(() =>
            Effect.andThen(
              Scope.close(scope, Exit.void),
              SubscriptionRef.set(status, { type: "exited", code: 127 }),
            ),
          ),
          Effect.mapError(
            (error) => new SendspinProcessError({ message: error.message }),
          ),
        );

      current = { scope };
      yield* SubscriptionRef.set(status, {
        type: "running",
        pid: Number(child.pid),
      });

      yield* child.stderr.pipe(
        Stream.run(fs.sink(logPath, { flag: "a" })),
        Effect.ignore,
        Effect.forkIn(scope),
      );

      yield* child.exitCode.pipe(
        Effect.flatMap((code) =>
          Effect.gen(function* () {
            if (current?.scope !== scope) return;
            current = undefined;
            yield* SubscriptionRef.set(status, {
              type: "exited",
              code: Number(code),
            });
          }),
        ),
        Effect.ignore,
        Effect.forkIn(scope),
      );
    }, Effect.provideContext(context));

    return Service.of({ status, start, stop });
  });

export const layer = (
  configuredBinary?: string,
): Layer.Layer<
  Service,
  never,
  FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> => Layer.effect(Service, make(configuredBinary));

export * as SendspinProcess from "./process.js";
