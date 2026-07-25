import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  t,
  bold,
  fg,
} from "@opentui/core";
import type { Locale } from "../i18n/index.js";
import type { PlayerProjection } from "../player.js";
import type { Theme } from "../theme.js";
import { formatHelpBar, globalHelp, type HelpEntry } from "./helpBar.js";

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
): string => {
  const width = Math.max(10, Math.min(60, (process.stdout.columns || 80) - 16));
  if (duration === null || duration === undefined || duration <= 0)
    return "─".repeat(width);
  const filled = Math.round(
    Math.min(1, Math.max(0, elapsed / duration)) * width,
  );
  return `${"━".repeat(filled)}${"─".repeat(width - filled)}`;
};

const statusLabel = (projection: PlayerProjection): string => {
  if (projection.connection.type !== "authenticated")
    return projection.connection.type;
  if (projection.process.type !== "running")
    return `audio ${projection.process.type}`;
  return projection.player?.playback_state ?? "stopped";
};

export class PlayerView {
  private readonly root: BoxRenderable;
  private readonly identity: TextRenderable;
  private readonly track: TextRenderable;
  private readonly details: TextRenderable;
  private readonly timeline: TextRenderable;
  private readonly progress: TextRenderable;
  private readonly queue: TextRenderable;
  private readonly status: TextRenderable;
  private readonly help: TextRenderable;

  constructor(
    renderer: CliRenderer,
    private readonly theme: Theme,
    private readonly strings: Locale,
    help: readonly HelpEntry[],
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
    });
    this.track = new TextRenderable(renderer, {
      id: "player-track",
      content: "",
      marginTop: 1,
    });
    this.details = new TextRenderable(renderer, {
      id: "player-details",
      content: "",
    });
    this.timeline = new TextRenderable(renderer, {
      id: "player-timeline",
      content: "",
      marginTop: 1,
    });
    this.progress = new TextRenderable(renderer, {
      id: "player-progress",
      content: "",
    });
    this.queue = new TextRenderable(renderer, {
      id: "player-queue",
      content: "",
      marginTop: 1,
    });
    this.status = new TextRenderable(renderer, {
      id: "player-status",
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
    this.root.add(this.identity);
    this.root.add(this.track);
    this.root.add(this.details);
    this.root.add(this.timeline);
    this.root.add(this.progress);
    this.root.add(this.queue);
    this.root.add(this.status);
    this.root.add(this.help);
    renderer.root.add(this.root);
    this.update({
      connection: { type: "connecting" },
      process: { type: "stopped" },
      title: strings.app.nothingPlaying,
      elapsed: 0,
    });
  }

  update(projection: PlayerProjection): void {
    if (
      (process.stdout.columns || 80) < 40 ||
      (process.stdout.rows || 24) < 10
    ) {
      this.track.content = this.strings.app.terminalTooSmall;
      return;
    }
    this.identity.content = t`${bold(fg(this.theme.accent)(projection.player?.name ?? this.strings.app.name))}`;
    this.track.content = t`${bold(fg(this.theme.fg)(projection.title || this.strings.app.nothingPlaying))}`;
    this.details.content = t`${fg(this.theme.fgMuted)([projection.artist, projection.album].filter(Boolean).join(" · "))}`;
    this.timeline.content = `${formatTime(projection.elapsed)} / ${formatTime(projection.duration)}`;
    this.progress.content = t`${fg(this.theme.accent)(progressBar(projection.elapsed, projection.duration))}`;
    const current = projection.queue?.current_item;
    const next = projection.queue?.next_item;
    this.queue.content = [
      current ? `▶ ${current.name}` : "",
      next ? `  ${next.name}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    this.status.content = t`${fg(projection.connection.type === "disconnected" || projection.process.type === "exited" ? this.theme.red : this.theme.fgSubtle)(statusLabel(projection))}`;
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }
}
