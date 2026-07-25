import { access, mkdir, open } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  Context,
  Effect,
  Layer,
  Schema,
  SubscriptionRef,
  type Scope,
} from "effect";

export const SUPPORTED_VERSION = "0.0.8";

export type ProcessStatus =
  | { readonly type: "stopped" }
  | { readonly type: "starting" }
  | { readonly type: "running"; readonly pid: number }
  | { readonly type: "exited"; readonly code: number };

export class SendspinProcessError extends Schema.TaggedErrorClass<SendspinProcessError>()(
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

const commandExists = async (command: string): Promise<boolean> => {
  if (command.includes("/")) {
    try {
      await access(command, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
  const result = Bun.spawnSync(
    ["sh", "-c", 'command -v -- "$1"', "sh", command],
    {
      stdout: "ignore",
      stderr: "ignore",
    },
  );
  return result.exitCode === 0;
};

export const resolveBinary = async (configured?: string): Promise<string> => {
  const candidates = [
    configured,
    "/usr/lib/music-assistant-tui/sendspin-rs-cli",
    join(process.cwd(), "dist", "sendspin-rs-cli"),
    "sendspin-rs-cli",
  ].filter((candidate): candidate is string => candidate !== undefined);
  for (const candidate of candidates) {
    if (await commandExists(candidate)) return candidate;
  }
  throw new Error("sendspin-rs-cli was not found; set SENDSPIN_PLAYER_BINARY");
};

export const sendspinAddress = (serverUrl: string): string => {
  const url = new URL(serverUrl);
  const host = url.hostname.includes(":") ? `[${url.hostname}]` : url.hostname;
  return `${host}:8927`;
};

export const make = (
  configuredBinary?: string,
  stateHome = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"),
): Effect.Effect<Interface, SendspinProcessError, Scope.Scope> =>
  Effect.gen(function* () {
    const status = yield* SubscriptionRef.make<ProcessStatus>({
      type: "stopped",
    });
    const context = yield* Effect.context<never>();
    let process: Bun.Subprocess<"ignore", "ignore", number> | undefined;

    const stop = Effect.gen(function* () {
      if (process !== undefined) {
        const child = process;
        process = undefined;
        if (child.exitCode === null) child.kill("SIGTERM");
        const exited = awaitWithin(child.exited, 2000);
        if (!(yield* Effect.promise(() => exited))) {
          if (child.exitCode === null) child.kill("SIGKILL");
          yield* Effect.promise(() => awaitWithin(child.exited, 1000));
        }
      }
      yield* SubscriptionRef.set(status, { type: "stopped" });
    });
    yield* Effect.addFinalizer(() => stop);

    const start = Effect.fn("SendspinProcess.start")(function* (
      options: StartOptions,
    ) {
      if (process !== undefined && process.exitCode === null) return;
      yield* SubscriptionRef.set(status, { type: "starting" });
      const binary = yield* Effect.tryPromise({
        try: () => resolveBinary(configuredBinary),
        catch: (error) =>
          new SendspinProcessError({
            message: error instanceof Error ? error.message : String(error),
          }),
      }).pipe(
        Effect.tapError(() =>
          SubscriptionRef.set(status, { type: "exited", code: 127 }),
        ),
      );
      const version = Bun.spawnSync([binary, "--version"]);
      const output = new TextDecoder().decode(version.stdout).trim();
      if (version.exitCode !== 0 || !output.includes(SUPPORTED_VERSION)) {
        yield* SubscriptionRef.set(status, { type: "exited", code: 126 });
        return yield* new SendspinProcessError({
          message: `Expected sendspin-rs-cli ${SUPPORTED_VERSION}, received '${output}'`,
        });
      }

      const logPath = join(stateHome, "music-assistant-tui", "sendspin.log");
      yield* Effect.promise(() => mkdir(dirname(logPath), { recursive: true }));
      const log = yield* Effect.promise(() => open(logPath, "a"));
      const child = yield* Effect.try({
        try: () =>
          Bun.spawn(
            [
              binary,
              "--server",
              sendspinAddress(options.serverUrl),
              "--client-id",
              options.playerId,
              "--name",
              options.playerName,
              "--volume",
              String(options.volume),
            ],
            { stdin: "ignore", stdout: "ignore", stderr: log.fd },
          ),
        catch: (error) =>
          new SendspinProcessError({
            message: error instanceof Error ? error.message : String(error),
          }),
      }).pipe(
        Effect.tapError(() => Effect.promise(() => log.close())),
        Effect.tapError(() =>
          SubscriptionRef.set(status, { type: "exited", code: 127 }),
        ),
      );
      process = child;
      yield* SubscriptionRef.set(status, { type: "running", pid: child.pid });
      void child.exited.then(async (code) => {
        await log.close();
        if (process === child) {
          process = undefined;
          Effect.runForkWith(context)(
            SubscriptionRef.set(status, { type: "exited", code }),
          );
        }
      });
    });

    return Service.of({ status, start, stop });
  });

const awaitWithin = <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<boolean> =>
  Promise.race([
    promise.then(() => true),
    Bun.sleep(timeoutMs).then(() => false),
  ]);

export const layer = (
  configuredBinary?: string,
): Layer.Layer<Service, SendspinProcessError> =>
  Layer.effect(Service, make(configuredBinary));

export * as SendspinProcess from "./process.js";
