import {
  type CliRenderer,
  type StyledText,
  BoxRenderable,
  TextRenderable,
  t,
  bold,
  fg,
} from "@opentui/core";
import type { Locale } from "../i18n/index.js";
import type { PlayerProjection } from "../player.js";
import type { Theme } from "../theme.js";
import { loadAlbumArt } from "./albumArt.js";
import { formatHelpBar, globalHelp, type HelpEntry } from "./helpBar.js";

const WIDE_MIN_COLUMNS = 72;
const WIDE_MIN_ROWS = 18;
const MIN_COLUMNS = 40;
const MIN_ROWS = 10;
const ARTWORK_PLACEHOLDER = [
  "                ",
  "       ♪        ",
  "      ♪♪        ",
  "     ♪ ♪        ",
  "       ♪        ",
  "      ♪♪        ",
  "                ",
].join("\n");

export type ArtworkLoader = (
  url: string,
  backgroundHex: string,
  signal: AbortSignal,
) => Promise<StyledText>;

const formatTime = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "LIVE";
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
};

const progressBar = (
  elapsed: number,
  duration: number | null | undefined,
  width: number,
): string => {
  const safeWidth = Math.max(10, width);
  if (duration === null || duration === undefined || duration <= 0)
    return "─".repeat(safeWidth);
  const filled = Math.round(
    Math.min(1, Math.max(0, elapsed / duration)) * safeWidth,
  );
  return `${"━".repeat(filled)}${"─".repeat(safeWidth - filled)}`;
};

const statusLabel = (projection: PlayerProjection): string => {
  if (projection.connection.type !== "authenticated")
    return projection.connection.type;
  if (projection.process.type !== "running")
    return `audio ${projection.process.type}`;
  const playback = projection.player?.playback_state ?? "stopped";
  const volume = projection.player?.volume_level;
  if (projection.player?.volume_muted) return `${playback} · muted`;
  return volume === null || volume === undefined
    ? playback
    : `${playback} · volume ${volume}%`;
};

export class PlayerView {
  private readonly root: BoxRenderable;
  private readonly identity: TextRenderable;
  private readonly main: BoxRenderable;
  private readonly artworkPane: BoxRenderable;
  private readonly artwork: TextRenderable;
  private readonly metadata: BoxRenderable;
  private readonly nowPlaying: TextRenderable;
  private readonly track: TextRenderable;
  private readonly details: TextRenderable;
  private readonly status: TextRenderable;
  private readonly timeline: BoxRenderable;
  private readonly elapsed: TextRenderable;
  private readonly progress: TextRenderable;
  private readonly duration: TextRenderable;
  private readonly queue: TextRenderable;
  private readonly help: TextRenderable;
  private projection: PlayerProjection;
  private artworkUrl: string | null = null;
  private artworkRequest?: AbortController;
  private artworkGeneration = 0;
  private readonly artworkCache = new Map<string, StyledText>();

  constructor(
    private readonly renderer: CliRenderer,
    private readonly theme: Theme,
    private readonly strings: Locale,
    help: readonly HelpEntry[],
    private readonly artworkLoader: ArtworkLoader = (url, background, signal) =>
      loadAlbumArt(url, background, { signal }),
  ) {
    this.root = new BoxRenderable(renderer, {
      id: "player-root",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: 1,
    });
    this.identity = new TextRenderable(renderer, {
      id: "player-identity",
      content: "",
      marginBottom: 1,
    });
    this.main = new BoxRenderable(renderer, {
      id: "player-main",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      columnGap: 3,
    });
    this.artworkPane = new BoxRenderable(renderer, {
      id: "player-artwork-pane",
      width: 18,
      height: 9,
      border: true,
      borderColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      shouldFill: !theme.transparent,
      backgroundColor: theme.bgElevated,
    });
    this.artwork = new TextRenderable(renderer, {
      id: "player-artwork",
      width: 16,
      height: 7,
      content: t`${fg(theme.fgGhost)(ARTWORK_PLACEHOLDER)}`,
    });
    this.metadata = new BoxRenderable(renderer, {
      id: "player-metadata",
      width: 42,
      flexDirection: "column",
      justifyContent: "center",
    });
    this.nowPlaying = new TextRenderable(renderer, {
      id: "player-now-playing",
      content: t`${bold(fg(theme.accent)(strings.player.nowPlaying))}`,
      marginBottom: 1,
    });
    this.track = new TextRenderable(renderer, {
      id: "player-track",
      content: "",
    });
    this.details = new TextRenderable(renderer, {
      id: "player-details",
      content: "",
    });
    this.status = new TextRenderable(renderer, {
      id: "player-status",
      content: "",
      marginTop: 1,
    });
    this.timeline = new BoxRenderable(renderer, {
      id: "player-timeline",
      width: 66,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      columnGap: 1,
      marginTop: 1,
    });
    this.elapsed = new TextRenderable(renderer, {
      id: "player-elapsed",
      content: "",
    });
    this.progress = new TextRenderable(renderer, {
      id: "player-progress",
      content: "",
    });
    this.duration = new TextRenderable(renderer, {
      id: "player-duration",
      content: "",
    });
    this.queue = new TextRenderable(renderer, {
      id: "player-queue",
      content: "",
      marginTop: 1,
    });
    this.help = new TextRenderable(renderer, {
      id: "player-help",
      content: formatHelpBar(theme, [
        ...help,
        { key: strings.keys.m, action: strings.help.menu },
        ...globalHelp(strings),
      ]),
      marginTop: 1,
    });
    this.artworkPane.add(this.artwork);
    this.metadata.add(this.nowPlaying);
    this.metadata.add(this.track);
    this.metadata.add(this.details);
    this.metadata.add(this.status);
    this.main.add(this.artworkPane);
    this.main.add(this.metadata);
    this.timeline.add(this.elapsed);
    this.timeline.add(this.progress);
    this.timeline.add(this.duration);
    this.root.add(this.identity);
    this.root.add(this.main);
    this.root.add(this.timeline);
    this.root.add(this.queue);
    this.root.add(this.help);
    renderer.root.add(this.root);
    this.projection = {
      connection: { type: "connecting" },
      process: { type: "stopped" },
      title: strings.app.nothingPlaying,
      elapsed: 0,
    };
    renderer.on("resize", this.handleResize);
    this.update(this.projection);
  }

  private readonly handleResize = () => this.renderProjection();

  private get isWide() {
    return (
      this.renderer.width >= WIDE_MIN_COLUMNS &&
      this.renderer.height >= WIDE_MIN_ROWS
    );
  }

  private renderProjection() {
    const projection = this.projection;
    const tooSmall =
      this.renderer.width < MIN_COLUMNS || this.renderer.height < MIN_ROWS;
    this.identity.visible = !tooSmall;
    this.timeline.visible = !tooSmall;
    this.queue.visible = !tooSmall;
    this.help.visible = !tooSmall;
    this.artworkPane.visible = !tooSmall && this.isWide;
    this.nowPlaying.visible = !tooSmall && this.isWide;
    this.status.visible = !tooSmall && this.isWide;
    this.main.width = this.isWide ? 64 : "100%";
    this.main.height = tooSmall ? 1 : this.isWide ? 9 : "auto";
    this.metadata.width = this.isWide ? 42 : "100%";
    this.metadata.alignItems = this.isWide ? "flex-start" : "center";
    this.track.content = tooSmall
      ? this.strings.app.terminalTooSmall
      : t`${bold(fg(this.theme.fg)(projection.title || this.strings.app.nothingPlaying))}`;
    if (tooSmall) return;

    this.identity.content = t`${bold(fg(this.theme.accent)(projection.player?.name ?? this.strings.app.name))}`;
    this.details.content = t`${fg(this.theme.fgMuted)([projection.artist, projection.album].filter(Boolean).join(" · "))}`;
    this.elapsed.content = formatTime(projection.elapsed);
    this.duration.content = formatTime(projection.duration);
    const timelineWidth = Math.min(66, Math.max(36, this.renderer.width - 8));
    this.timeline.width = timelineWidth;
    this.progress.content = t`${fg(this.theme.accent)(progressBar(projection.elapsed, projection.duration, timelineWidth - 14))}`;
    this.queue.content = projection.queue?.next_item
      ? t`${bold(fg(this.theme.fgSubtle)(this.strings.player.upNext))}  ${fg(this.theme.fgMuted)(projection.queue.next_item.name)}`
      : "";
    this.status.content = t`${fg(projection.connection.type === "disconnected" || projection.process.type === "exited" ? this.theme.red : this.theme.fgSubtle)(statusLabel(projection))}`;
    if (!this.isWide) {
      this.details.content = t`${fg(this.theme.fgMuted)(
        [projection.artist, projection.album, statusLabel(projection)]
          .filter(Boolean)
          .join(" · "),
      )}`;
    }
  }

  private loadArtwork(url: string | null) {
    if (url === this.artworkUrl) return;
    this.artworkUrl = url;
    this.artworkRequest?.abort();
    this.artworkRequest = undefined;
    this.artwork.content = t`${fg(this.theme.fgGhost)(ARTWORK_PLACEHOLDER)}`;
    if (!url) return;
    const cached = this.artworkCache.get(url);
    if (cached) {
      this.artwork.content = cached;
      return;
    }
    const request = new AbortController();
    const generation = ++this.artworkGeneration;
    this.artworkRequest = request;
    void this.artworkLoader(url, this.theme.bgElevated, request.signal)
      .then((artwork) => {
        if (request.signal.aborted || generation !== this.artworkGeneration)
          return;
        this.artworkCache.set(url, artwork);
        if (this.artworkCache.size > 8) {
          const oldestUrl = this.artworkCache.keys().next().value;
          if (oldestUrl !== undefined) this.artworkCache.delete(oldestUrl);
        }
        this.artwork.content = artwork;
      })
      .catch(() => {})
      .finally(() => {
        if (this.artworkRequest === request) this.artworkRequest = undefined;
      });
  }

  update(projection: PlayerProjection): void {
    this.projection = projection;
    this.renderProjection();
    this.loadArtwork(projection.artworkUrl ?? null);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  destroy(): void {
    this.artworkRequest?.abort();
    this.renderer.off("resize", this.handleResize);
    this.renderer.root.remove(this.root);
  }
}
