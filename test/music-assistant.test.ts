import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  accumulatePartialResult,
  classifyMessage,
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
});
