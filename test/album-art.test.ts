import { describe, expect, test } from "bun:test";
import { RGBA } from "@opentui/core";
import {
  ALBUM_ART_HEIGHT,
  ALBUM_ART_WIDTH,
  bitmapToStyledText,
  loadAlbumArt,
} from "../src/tui/albumArt.js";

const bitmap = (pixel: readonly [number, number, number, number]) => {
  const data = new Uint8Array(ALBUM_ART_WIDTH * ALBUM_ART_HEIGHT * 2 * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set(pixel, offset);
  }
  return {
    width: ALBUM_ART_WIDTH,
    height: ALBUM_ART_HEIGHT * 2,
    data,
  };
};

describe("album art", () => {
  test("pairs upper and lower pixels into half blocks", () => {
    const image = bitmap([0, 0, 0, 255]);
    image.data.set([255, 0, 0, 255], 0);
    image.data.set([0, 0, 255, 255], ALBUM_ART_WIDTH * 4);

    const art = bitmapToStyledText(image, "#000000");

    expect(art.chunks[0]?.text).toBe("▀");
    expect(art.chunks[0]?.fg?.toInts()).toEqual([255, 0, 0, 255]);
    expect(art.chunks[0]?.bg?.toInts()).toEqual([0, 0, 255, 255]);
    expect(
      art.chunks
        .map(({ text }) => text)
        .join("")
        .split("\n"),
    ).toHaveLength(ALBUM_ART_HEIGHT);
  });

  test("composites transparency and coalesces equal cells", () => {
    const art = bitmapToStyledText(bitmap([255, 255, 255, 0]), "#102030");
    const first = art.chunks[0];

    expect(first?.text).toBe("▀".repeat(ALBUM_ART_WIDTH));
    expect(first?.fg?.equals(RGBA.fromHex("#102030"))).toBe(true);
    expect(first?.bg?.equals(RGBA.fromHex("#102030"))).toBe(true);
  });

  test("rejects failed and oversized responses", async () => {
    await expect(
      loadAlbumArt("https://example.com/art.jpg", "#000000", {
        fetch: async () => new Response(null, { status: 404 }),
      }),
    ).rejects.toThrow("404");
    await expect(
      loadAlbumArt("https://example.com/art.jpg", "#000000", {
        maxBytes: 4,
        fetch: async () => new Response(new Uint8Array(5)),
      }),
    ).rejects.toThrow("download limit");
  });
});
