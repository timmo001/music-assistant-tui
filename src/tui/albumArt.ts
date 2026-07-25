import { Jimp } from "jimp";
import { RGBA, StyledText, type TextChunk } from "@opentui/core";

export const ALBUM_ART_WIDTH = 16;
export const ALBUM_ART_HEIGHT = 7;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export interface ArtworkBitmap {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

interface LoadArtworkOptions {
  readonly signal?: AbortSignal;
  readonly fetch?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  readonly maxBytes?: number;
}

const compositeChannel = (channel: number, background: number, alpha: number) =>
  Math.round((channel * alpha + background * (255 - alpha)) / 255);

const pixelColor = (
  bitmap: ArtworkBitmap,
  offset: number,
  background: readonly [number, number, number],
) => {
  const alpha = bitmap.data[offset + 3] ?? 0;
  return RGBA.fromInts(
    compositeChannel(bitmap.data[offset] ?? 0, background[0], alpha),
    compositeChannel(bitmap.data[offset + 1] ?? 0, background[1], alpha),
    compositeChannel(bitmap.data[offset + 2] ?? 0, background[2], alpha),
  );
};

const appendChunk = (chunks: TextChunk[], chunk: TextChunk) => {
  const previous = chunks.at(-1);
  if (
    previous?.text !== "\n" &&
    previous?.fg?.equals(chunk.fg) &&
    previous?.bg?.equals(chunk.bg)
  ) {
    previous.text += chunk.text;
    return;
  }
  chunks.push(chunk);
};

export const bitmapToStyledText = (
  bitmap: ArtworkBitmap,
  backgroundHex: string,
): StyledText => {
  if (
    bitmap.width !== ALBUM_ART_WIDTH ||
    bitmap.height !== ALBUM_ART_HEIGHT * 2 ||
    bitmap.data.length !== bitmap.width * bitmap.height * 4
  ) {
    throw new Error("Album artwork bitmap must be 16x16 RGBA pixels");
  }
  const [backgroundRed, backgroundGreen, backgroundBlue] =
    RGBA.fromHex(backgroundHex).toInts();
  const background = [backgroundRed, backgroundGreen, backgroundBlue] as const;
  const chunks: TextChunk[] = [];
  for (let row = 0; row < bitmap.height; row += 2) {
    for (let column = 0; column < bitmap.width; column += 1) {
      const upperOffset = (row * bitmap.width + column) * 4;
      const lowerOffset = ((row + 1) * bitmap.width + column) * 4;
      appendChunk(chunks, {
        __isChunk: true,
        text: "▀",
        fg: pixelColor(bitmap, upperOffset, background),
        bg: pixelColor(bitmap, lowerOffset, background),
      });
    }
    if (row + 2 < bitmap.height) {
      chunks.push({ __isChunk: true, text: "\n" });
    }
  }
  return new StyledText(chunks);
};

export const loadAlbumArt = async (
  url: string,
  backgroundHex: string,
  options: LoadArtworkOptions = {},
): Promise<StyledText> => {
  const response = await (options.fetch ?? globalThis.fetch)(url, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`Album artwork request failed with ${response.status}`);
  }
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Album artwork exceeds the download limit");
  }
  if (!response.body) throw new Error("Album artwork response is empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maxBytes) {
      await reader.cancel();
      throw new Error("Album artwork exceeds the download limit");
    }
    chunks.push(value);
  }
  const encoded = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    encoded.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const image = await Jimp.read(Buffer.from(encoded));
  image.cover({ w: ALBUM_ART_WIDTH, h: ALBUM_ART_HEIGHT * 2 });
  return bitmapToStyledText(
    {
      data: image.bitmap.data,
      width: image.bitmap.width,
      height: image.bitmap.height,
    },
    backgroundHex,
  );
};
