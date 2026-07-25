import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { selectServer } from "../src/music-assistant/discovery.js";

describe("Music Assistant discovery selection", () => {
  test("prefers an explicit server URL", async () => {
    expect(
      await Effect.runPromise(
        selectServer("music.local:8095", [
          { name: "Other", url: "http://other.local:8095" },
        ]),
      ),
    ).toBe("http://music.local:8095");
  });

  test("requires selection when multiple servers are found", async () => {
    const result = await Effect.runPromiseExit(
      selectServer(undefined, [
        { name: "One", url: "http://one.local:8095" },
        { name: "Two", url: "http://two.local:8095" },
      ]),
    );
    expect(result._tag).toBe("Failure");
  });
});
