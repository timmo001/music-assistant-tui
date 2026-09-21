import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  accumulatePartialResult,
  classifyMessage,
  createCommandMessage,
  MessageId,
  normalizeBaseUrl,
  toWebSocketUrl,
} from "../src/music-assistant/index.js";

describe("Music Assistant protocol", () => {
  test("normalizes server and WebSocket URLs", () => {
    expect(normalizeBaseUrl("music.local:8095/")).toBe(
      "http://music.local:8095",
    );
    expect(toWebSocketUrl("https://music.example/path/")).toBe(
      "wss://music.example/path/ws",
    );
  });

  test("classifies numeric API errors", async () => {
    const result = await Effect.runPromise(
      classifyMessage({ message_id: "1", error_code: 2, details: "nope" }),
    );

    expect(result.type).toBe("error");
  });

  test("accumulates partial arrays", () => {
    expect(
      accumulatePartialResult([], {
        message_id: MessageId.make("1"),
        result: ["a", "b"],
        partial: true,
      }),
    ).toEqual(["a", "b"]);
  });

  test("preserves omitted command arguments and nested JSON payloads", () => {
    const id = MessageId.make("1");

    expect(createCommandMessage(id, "players/all")).toEqual({
      message_id: id,
      command: "players/all",
    });
    expect(
      createCommandMessage(id, "custom", {
        enabled: true,
        selection: { items: [1, "track", null] },
      }).args,
    ).toEqual({ enabled: true, selection: { items: [1, "track", null] } });
  });

  test.each(
    [null, false, 0, "ok", [1, null], { nested: [true, "value"] }].map(
      (result) => ({ result }),
    ),
  )("classifies JSON command result %j", async ({ result }) => {
    expect(
      await Effect.runPromise(classifyMessage({ message_id: "1", result })),
    ).toEqual({
      type: "success",
      value: { message_id: MessageId.make("1"), result },
    });
  });

  test.each([null, "invalid", { event: 1, message_id: "1", result: true }])(
    "rejects malformed messages without reclassifying them: %j",
    async (message) => {
      const exit = await Effect.runPromiseExit(classifyMessage(message));

      expect(exit._tag).toBe("Failure");
    },
  );
});
