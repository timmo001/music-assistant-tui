import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { Effect, Schema } from "effect";

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

export class ConfigurationError extends Schema.TaggedErrorClass<ConfigurationError>()(
  "ConfigurationError",
  { message: Schema.String },
) {}

export const configPath = (env: Readonly<Record<string, string | undefined>>) =>
  join(
    env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "music-assistant-tui",
    "config.json",
  );

const readConfigFile = async (path: string): Promise<ConfigFile> => {
  try {
    return await Schema.decodeUnknownPromise(ConfigFile)(
      JSON.parse(await readFile(path, "utf8")),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }
    throw error;
  }
};

const writeConfigFile = async (path: string, file: ConfigFile) => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
};

export const saveConnectionConfig = (
  path: string,
  connection: ConnectionConfig,
): Effect.Effect<void, ConfigurationError> =>
  Effect.tryPromise({
    try: async () => {
      const file = await readConfigFile(path);
      const { serverUrl: _serverUrl, ...rest } = file;
      const next = await Schema.decodeUnknownPromise(ConfigFile)(
        connection.serverUrl === undefined
          ? { ...rest, token: connection.token }
          : {
              ...rest,
              serverUrl: connection.serverUrl,
              token: connection.token,
            },
      );
      await writeConfigFile(path, next);
    },
    catch: (error) =>
      new ConfigurationError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });

export const loadConfig = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): Effect.Effect<AppConfig, ConfigurationError> =>
  Effect.tryPromise({
    try: async () => {
      const path = configPath(env);
      const file = await readConfigFile(path);

      if (file.token !== undefined) {
        const metadata = await stat(path);
        if ((metadata.mode & 0o077) !== 0) {
          throw new Error(
            `Configuration file containing a token must use mode 0600: ${path}`,
          );
        }
      }

      const sendspinPlayerId =
        file.sendspinPlayerId ?? `music-assistant-tui-${randomUUID()}`;
      if (file.sendspinPlayerId === undefined) {
        await writeConfigFile(path, { ...file, sendspinPlayerId });
      }

      return {
        path,
        serverUrl: env.MUSIC_ASSISTANT_URL ?? file.serverUrl,
        token: env.MUSIC_ASSISTANT_TOKEN ?? file.token,
        sendspinPlayerId,
        playerName: file.playerName ?? "Music Assistant TUI",
        volume: file.volume ?? 30,
        sendspinBinary: env.SENDSPIN_PLAYER_BINARY ?? file.sendspinBinary,
      };
    },
    catch: (error) =>
      new ConfigurationError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });
