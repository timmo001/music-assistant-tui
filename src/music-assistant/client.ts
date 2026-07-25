import { randomUUID } from "node:crypto";
import {
  Context,
  Effect,
  Layer,
  Schema,
  SubscriptionRef,
  type Scope,
} from "effect";
import {
  accumulatePartialResult,
  classifyMessage,
  makeCommand,
  normalizeServerInfoUrls,
  toWebSocketUrl,
} from "./api.js";
import {
  MessageId,
  Player,
  PlayerQueue,
  type EventMessage,
  type ServerInfo,
} from "./models.js";

export const API_SCHEMA_VERSION = 33;

export type ConnectionStatus =
  | { readonly type: "connecting" }
  | { readonly type: "authenticated"; readonly server: ServerInfo }
  | { readonly type: "disconnected"; readonly message: string };

export interface MusicAssistantSnapshot {
  readonly connection: ConnectionStatus;
  readonly players: ReadonlyMap<string, Player>;
  readonly queues: ReadonlyMap<string, PlayerQueue>;
}

export class MusicAssistantError extends Schema.TaggedErrorClass<MusicAssistantError>()(
  "MusicAssistantError",
  { message: Schema.String },
) {}

interface Options {
  readonly serverUrl: string;
  readonly token: string;
  readonly webSocket?: (url: string) => WebSocket;
}

interface PendingCommand {
  readonly partial: unknown[];
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: MusicAssistantError) => void;
}

export interface Interface {
  readonly state: SubscriptionRef.SubscriptionRef<MusicAssistantSnapshot>;
  readonly command: (
    command: string,
    args?: Readonly<Record<string, unknown>>,
  ) => Effect.Effect<unknown, MusicAssistantError>;
  readonly disconnect: Effect.Effect<void>;
}

export class Service extends Context.Service<Service, Interface>()(
  "@music-assistant-tui/MusicAssistant",
) {}

const emptySnapshot = (): MusicAssistantSnapshot => ({
  connection: { type: "connecting" },
  players: new Map(),
  queues: new Map(),
});

const decodePlayers = Schema.decodeUnknownPromise(Schema.Array(Player));
const decodeQueues = Schema.decodeUnknownPromise(Schema.Array(PlayerQueue));

export const connect = (
  options: Options,
): Effect.Effect<Interface, MusicAssistantError, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const state = await Effect.runPromise(
          SubscriptionRef.make(emptySnapshot()),
        );
        const pending = new Map<string, PendingCommand>();
        const socket = (options.webSocket ?? ((url) => new WebSocket(url)))(
          toWebSocketUrl(options.serverUrl),
        );
        let serverInfo: ServerInfo | undefined;

        const setState = (
          update: (current: MusicAssistantSnapshot) => MusicAssistantSnapshot,
        ) => Effect.runFork(SubscriptionRef.update(state, update));

        const failPending = (message: string) => {
          for (const request of pending.values()) {
            request.reject(new MusicAssistantError({ message }));
          }
          pending.clear();
        };

        const applyEvent = async (event: EventMessage) => {
          switch (event.event) {
            case "player_added":
            case "player_updated": {
              const player = await Schema.decodeUnknownPromise(Player)(
                event.data,
              );
              setState((current) => ({
                ...current,
                players: new Map(current.players).set(player.player_id, player),
              }));
              return;
            }
            case "player_removed":
              if (event.object_id !== undefined && event.object_id !== null) {
                setState((current) => {
                  const players = new Map(current.players);
                  players.delete(event.object_id!);
                  return { ...current, players };
                });
              }
              return;
            case "queue_added":
            case "queue_updated": {
              const queue = await Schema.decodeUnknownPromise(PlayerQueue)(
                event.data,
              );
              setState((current) => ({
                ...current,
                queues: new Map(current.queues).set(queue.queue_id, queue),
              }));
              return;
            }
            case "queue_time_updated":
              if (
                event.object_id !== undefined &&
                event.object_id !== null &&
                typeof event.data === "number"
              ) {
                setState((current) => {
                  const queue = current.queues.get(event.object_id!);
                  if (queue === undefined) return current;
                  return {
                    ...current,
                    queues: new Map(current.queues).set(event.object_id!, {
                      ...queue,
                      elapsed_time: event.data as number,
                      elapsed_time_last_updated: Date.now() / 1000,
                    }),
                  };
                });
              }
          }
        };

        socket.addEventListener("message", (event) => {
          void (async () => {
            const raw = JSON.parse(String(event.data));
            const message = await Effect.runPromise(classifyMessage(raw));
            if (message.type === "server-info") {
              serverInfo = normalizeServerInfoUrls(message.value);
              return;
            }
            if (message.type === "event") {
              await applyEvent(message.value);
              return;
            }
            const request = pending.get(message.value.message_id);
            if (request === undefined) return;
            if (message.type === "error") {
              pending.delete(message.value.message_id);
              request.reject(
                new MusicAssistantError({
                  message:
                    message.value.details ??
                    `API error ${message.value.error_code}`,
                }),
              );
              return;
            }
            if (message.value.partial) {
              request.partial.push(
                ...accumulatePartialResult([], message.value),
              );
              return;
            }
            pending.delete(message.value.message_id);
            if (request.partial.length > 0) {
              request.resolve([
                ...request.partial,
                ...accumulatePartialResult([], message.value),
              ]);
            } else {
              request.resolve(message.value.result);
            }
          })().catch((error) =>
            failPending(error instanceof Error ? error.message : String(error)),
          );
        });

        socket.addEventListener("close", () => {
          const message = "Music Assistant connection closed";
          failPending(message);
          setState((current) => ({
            ...current,
            connection: { type: "disconnected", message },
          }));
        });

        const opened = new Promise<void>((resolve, reject) => {
          socket.addEventListener("open", () => resolve(), { once: true });
          socket.addEventListener(
            "error",
            () => reject(new Error("WebSocket connection failed")),
            {
              once: true,
            },
          );
        });

        const commandPromise = (
          name: string,
          args?: Readonly<Record<string, unknown>>,
        ): Promise<unknown> => {
          const id = MessageId.make(randomUUID().replaceAll("-", ""));
          return new Promise((resolve, reject) => {
            pending.set(id, { partial: [], resolve, reject });
            socket.send(JSON.stringify(makeCommand(id, name, args)));
          });
        };

        try {
          await opened;
          const serverDeadline = Date.now() + 5000;
          while (serverInfo === undefined && Date.now() < serverDeadline) {
            await Bun.sleep(10);
          }
          if (serverInfo === undefined)
            throw new Error("Music Assistant server info timed out");
          if (serverInfo.min_supported_schema_version > API_SCHEMA_VERSION) {
            throw new Error(
              `Server requires API schema ${serverInfo.min_supported_schema_version}; client supports ${API_SCHEMA_VERSION}`,
            );
          }
          if (!(await commandPromise("auth", { token: options.token }))) {
            throw new Error("Music Assistant authentication failed");
          }

          const [players, queues] = await Promise.all([
            commandPromise("players/all").then(decodePlayers),
            commandPromise("player_queues/all").then(decodeQueues),
          ]);
          await Effect.runPromise(
            SubscriptionRef.set(state, {
              connection: { type: "authenticated", server: serverInfo },
              players: new Map(
                players.map((player) => [player.player_id, player]),
              ),
              queues: new Map(queues.map((queue) => [queue.queue_id, queue])),
            }),
          );

          const command = Effect.fn("MusicAssistant.command")(
            (name: string, args?: Readonly<Record<string, unknown>>) =>
              Effect.tryPromise({
                try: () => commandPromise(name, args),
                catch: (error) =>
                  error instanceof MusicAssistantError
                    ? error
                    : new MusicAssistantError({
                        message:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      }),
              }),
          );
          const disconnect = Effect.sync(() => socket.close(1000, "shutdown"));
          return Service.of({ state, command, disconnect });
        } catch (error) {
          socket.close(1000, "connection setup failed");
          throw error;
        }
      },
      catch: (error) =>
        error instanceof MusicAssistantError
          ? error
          : new MusicAssistantError({
              message: error instanceof Error ? error.message : String(error),
            }),
    }),
    (service) => service.disconnect,
  );

export const layer = (
  options: Options,
): Layer.Layer<Service, MusicAssistantError> =>
  Layer.effect(Service, connect(options));

export * as MusicAssistantClient from "./client.js";
