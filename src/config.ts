import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { homedir, hostname } from "node:os";
import { Effect, FileSystem, Schema } from "effect";

const ConfigFile = Schema.Struct({
  serverUrl: Schema.optionalKey(Schema.String),
  token: Schema.optionalKey(Schema.String),
  sendspinPlayerId: Schema.optionalKey(Schema.String),
  playerName: Schema.optionalKey(Schema.String),
  volume: Schema.optionalKey(
    Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  ),
  sendspinBinary: Schema.optionalKey(Schema.String),
});

type ConfigFile = typeof ConfigFile.Type;

export interface AppConfig {
  readonly path: string;
  readonly serverUrl?: string;
  readonly token?: string;
  readonly sendspinPlayerId: string;
  readonly playerName: string;
  readonly volume: number;
  readonly sendspinBinary?: string;
}

export interface ConnectionConfig {
  readonly serverUrl?: string;
  readonly token: string;
}

export class ConfigurationError extends Schema.TaggedError<ConfigurationError>()(
  "ConfigurationError",
  { message: Schema.String },
) {}

export const configPath = (env: Readonly<Record<string, string | undefined>>) =>
  join(
    env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "music-assistant-tui",
    "config.json",
  );

const toConfigurationError = (error: { readonly message: string }) =>
  new ConfigurationError({ message: error.message });

const readConfigFile = Effect.fn("Config.read")(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;

  return yield* fs.readFileString(path).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(Schema.fromJsonString(ConfigFile)),
    ),
    Effect.catchReason("PlatformError", "NotFound", () =>
      Effect.succeed<ConfigFile>({}),
    ),
  );
}, Effect.mapError(toConfigurationError));

const writeConfigFile = Effect.fn("Config.write")(function* (
  path: string,
  file: ConfigFile,
) {
  const fs = yield* FileSystem.FileSystem;

  yield* fs.makeDirectory(dirname(path), { recursive: true, mode: 0o700 });
  yield* fs.writeFileString(path, `${JSON.stringify(file, null, 2)}\n`, {
    mode: 0o600,
  });
  yield* fs.chmod(path, 0o600);
}, Effect.mapError(toConfigurationError));

export const saveConnectionConfig = Effect.fn("Config.saveConnection")(
  function* (path: string, connection: ConnectionConfig) {
    const file = yield* readConfigFile(path);
    const { serverUrl: _serverUrl, ...rest } = file;

    const next = yield* Schema.decodeEffect(ConfigFile)(
      connection.serverUrl === undefined
        ? { ...rest, token: connection.token }
        : {
            ...rest,
            serverUrl: connection.serverUrl,
            token: connection.token,
          },
    );

    yield* writeConfigFile(path, next);
  },
  Effect.mapError(toConfigurationError),
);

export const savePlayerName = Effect.fn("Config.savePlayerName")(function* (
  path: string,
  playerName: string,
) {
  const file = yield* readConfigFile(path);

  yield* writeConfigFile(
    path,
    yield* Schema.decodeEffect(ConfigFile)({ ...file, playerName }),
  );
}, Effect.mapError(toConfigurationError));

export const loadConfig = (
  environment: Readonly<Record<string, string | undefined>>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = configPath(environment);
    const file = yield* readConfigFile(path);

    if (file.token !== undefined) {
      const metadata = yield* fs.stat(path);

      if ((metadata.mode & 0o077) !== 0) {
        return yield* new ConfigurationError({
          message: `Configuration file containing a token must use mode 0600: ${path}`,
        });
      }
    }

    const sendspinPlayerId =
      file.sendspinPlayerId ?? `music-assistant-tui-${randomUUID()}`;

    if (file.sendspinPlayerId === undefined) {
      yield* writeConfigFile(path, { ...file, sendspinPlayerId });
    }

    const config: AppConfig = {
      path,
      serverUrl: environment.MUSIC_ASSISTANT_URL ?? file.serverUrl,
      token: environment.MUSIC_ASSISTANT_TOKEN ?? file.token,
      sendspinPlayerId,
      playerName: file.playerName ?? `${hostname()} - Music Assistant TUI`,
      volume: file.volume ?? 30,
      sendspinBinary: environment.SENDSPIN_PLAYER_BINARY ?? file.sendspinBinary,
    };

    return config;
  }).pipe(Effect.mapError(toConfigurationError));
