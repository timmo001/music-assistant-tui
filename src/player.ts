import type {
  ConnectionStatus,
  MusicAssistantSnapshot,
} from "./music-assistant/client.js";
import type {
  MediaItemImage,
  Player,
  PlayerQueue,
} from "./music-assistant/models.js";
import type { ProcessStatus } from "./sendspin/process.js";
import { correctedElapsedTime } from "./music-assistant/api.js";

export interface PlayerProjection {
  readonly connection: ConnectionStatus;
  readonly process: ProcessStatus;
  readonly player?: Player;
  readonly queue?: PlayerQueue;
  readonly title: string;
  readonly artist?: string | null;
  readonly album?: string | null;
  readonly artworkUrl?: string | null;
  readonly elapsed: number;
  readonly duration?: number | null;
}

const universalPlayerId = (playerId: string) =>
  `up${playerId.replaceAll(/[:_-]/g, "").toLowerCase()}`;

const normalizePlayerArtworkUrl = (
  imageUrl: string | null | undefined,
  baseUrl: string | null | undefined,
): string | null => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:image")) return imageUrl;
  try {
    const url = new URL(imageUrl, baseUrl ?? undefined);
    if (baseUrl && url.pathname.startsWith("/imageproxy")) {
      return new URL(`${url.pathname}${url.search}`, baseUrl).toString();
    }
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const queueArtworkUrl = (
  image: MediaItemImage | null | undefined,
  baseUrl: string | null | undefined,
  schemaVersion: number | undefined,
): string | null => {
  if (!image) return null;
  if (image.remotely_accessible) {
    return normalizePlayerArtworkUrl(image.path, baseUrl);
  }
  if (!baseUrl) return null;
  if (schemaVersion !== undefined && schemaVersion >= 31 && image.proxy_id) {
    const url = new URL(`/imageproxy/${image.proxy_id}`, baseUrl);
    url.search = new URLSearchParams({ size: "80", fmt: "jpg" }).toString();
    return url.toString();
  }
  const url = new URL("/imageproxy", baseUrl);
  url.search = new URLSearchParams({
    path: encodeURIComponent(image.path),
    provider: image.provider,
    size: "80",
  }).toString();
  return url.toString();
};

export const projectPlayer = (
  snapshot: MusicAssistantSnapshot,
  process: ProcessStatus,
  playerId: string,
  nowSeconds = Date.now() / 1000,
): PlayerProjection => {
  const player =
    snapshot.players.get(playerId) ??
    snapshot.players.get(universalPlayerId(playerId));
  const queue = snapshot.queues.get(player?.player_id ?? playerId);
  const media = player?.current_media;
  const item = queue?.current_item;
  const server =
    snapshot.connection.type === "authenticated"
      ? snapshot.connection.server
      : undefined;
  const baseUrl = server?.base_url;
  return {
    connection: snapshot.connection,
    process,
    player,
    queue,
    title: media?.title ?? item?.name ?? "Nothing playing",
    artist: media?.artist ?? null,
    album: media?.album ?? null,
    artworkUrl:
      normalizePlayerArtworkUrl(media?.image_url, baseUrl) ??
      queueArtworkUrl(item?.image, baseUrl, server?.schema_version),
    elapsed:
      queue !== undefined
        ? correctedElapsedTime(
            queue.elapsed_time,
            queue.elapsed_time_last_updated,
            queue.state,
            queue.playback_speed,
            nowSeconds,
          )
        : (media?.elapsed_time ?? player?.elapsed_time ?? 0),
    duration: media?.duration ?? item?.duration ?? null,
  };
};
