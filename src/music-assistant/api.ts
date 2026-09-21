import { Effect, flow, Schema } from "effect";
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

export const createCommandMessage = (
  messageId: MessageId,
  command: string,
  args?: NonNullable<CommandMessage["args"]>,
): CommandMessage => {
  const message: CommandMessage = {
    message_id: messageId,
    command,
  };

  return CommandMessage.make(
    args === undefined ? message : { ...message, args },
  );
};

export type ClassifiedMessage =
  | { readonly type: "server-info"; readonly value: ServerInfo }
  | { readonly type: "event"; readonly value: EventMessage }
  | { readonly type: "error"; readonly value: ErrorResultMessage }
  | { readonly type: "success"; readonly value: SuccessResultMessage };

export const classifyMessage = flow(
  Schema.decodeUnknownEffect(Schema.ObjectKeyword),
  Effect.flatMap(
    Effect.fn("MusicAssistant.classifyMessage")(function* (input) {
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

      return {
        type: "server-info",
        value: yield* Schema.decodeUnknownEffect(ServerInfo)(input),
      } as const;
    }),
  ),
);

export const accumulatePartialResult = (
  current: readonly Schema.Json[],
  message: SuccessResultMessage,
): readonly Schema.Json[] => [
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
