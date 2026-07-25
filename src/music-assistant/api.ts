import { Effect, Schema } from "effect";
import {
  CommandMessage,
  ErrorResultMessage,
  EventMessage,
  MessageId,
  ServerInfo,
  SuccessResultMessage,
} from "./models.js";

export const normalizeBaseUrl = (input: string): string => {
  const withScheme = /^https?:\/\//i.test(input) ? input : `http://${input}`;
  const url = new URL(withScheme);
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
};

export const toWebSocketUrl = (baseUrl: string): string => {
  const url = new URL(normalizeBaseUrl(baseUrl));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  return url.toString();
};

export const makeCommand = (
  messageId: MessageId,
  command: string,
  args?: Readonly<Record<string, unknown>>,
): CommandMessage =>
  CommandMessage.make({
    message_id: messageId,
    command,
    ...(args === undefined ? {} : { args }),
  });

export type ClassifiedMessage =
  | { readonly type: "server-info"; readonly value: ServerInfo }
  | { readonly type: "event"; readonly value: EventMessage }
  | { readonly type: "error"; readonly value: ErrorResultMessage }
  | { readonly type: "success"; readonly value: SuccessResultMessage };

export const classifyMessage = Effect.fn("MusicAssistant.classifyMessage")(
  function* (input: unknown) {
    if (typeof input === "object" && input !== null) {
      if ("event" in input) {
        return {
          type: "event",
          value: yield* Schema.decodeUnknownEffect(EventMessage)(input),
        } as const;
      }
      if ("error_code" in input) {
        return {
          type: "error",
          value: yield* Schema.decodeUnknownEffect(ErrorResultMessage)(input),
        } as const;
      }
      if ("result" in input) {
        return {
          type: "success",
          value: yield* Schema.decodeUnknownEffect(SuccessResultMessage)(input),
        } as const;
      }
    }
    return {
      type: "server-info",
      value: yield* Schema.decodeUnknownEffect(ServerInfo)(input),
    } as const;
  },
);

export const accumulatePartialResult = (
  current: readonly unknown[],
  message: SuccessResultMessage,
): readonly unknown[] => [
  ...current,
  ...(Array.isArray(message.result) ? message.result : [message.result]),
];

export const correctedElapsedTime = (
  elapsed: number,
  updatedAtSeconds: number,
  playbackState: string,
  playbackSpeed = 1,
  nowSeconds = Date.now() / 1000,
): number =>
  playbackState === "playing"
    ? Math.max(0, elapsed + (nowSeconds - updatedAtSeconds) * playbackSpeed)
    : Math.max(0, elapsed);

export const normalizeServerInfoUrls = (info: ServerInfo): ServerInfo => ({
  ...info,
  base_url: info.base_url ?? info.internal_url,
  internal_url: info.internal_url ?? info.base_url,
});
