import type {
  ConnectionStatus,
  MusicAssistantSnapshot,
} from "./music-assistant/client.js";
import type { Player, PlayerQueue } from "./music-assistant/models.js";
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
  readonly elapsed: number;
  readonly duration?: number | null;
}

const universalPlayerId = (playerId: string) =>
  `up${playerId.replaceAll(/[:_-]/g, "").toLowerCase()}`;

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
  return {
    connection: snapshot.connection,
    process,
    player,
    queue,
    title: media?.title ?? item?.name ?? "Nothing playing",
    artist: media?.artist ?? null,
    album: media?.album ?? null,
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
