import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { applyMetadataPatch, decodeEnvelope } from "../src/sendspin/index.js";

describe("Sendspin protocol", () => {
  test("decodes a version 1 server hello", async () => {
    const message = await Effect.runPromise(
      decodeEnvelope({ type: "server/hello", payload: { name: "Server" } }),
    );
    expect(message.type).toBe("server/hello");
  });

  test("rejects malformed identities", async () => {
    const exit = await Effect.runPromiseExit(
      decodeEnvelope({
        type: "client/init",
        payload: {
          client_id: "short",
          version: 1,
          suite: "25519_ChaChaPoly_SHA256",
        },
      }),
    );
    expect(exit._tag).toBe("Failure");
  });

  test("retains omitted state and clears null leaves", () => {
    expect(
      applyMetadataPatch({ title: "Track", artist: "Artist" }, { title: null }),
    ).toEqual({ artist: "Artist" });
    expect(applyMetadataPatch({ title: "Track" }, null)).toBeNull();
  });
});
