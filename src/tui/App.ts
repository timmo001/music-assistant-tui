import type { CliRenderer, KeyEvent } from "@opentui/core";
import type { Locale } from "../i18n/index.js";
import type { MenuRegistry } from "../menu.js";
import type { Theme } from "../theme.js";
import type { MenuAction, ViewId } from "../types.js";
import type { PlayerProjection } from "../player.js";
import { playerCommandForKey, playerHelp } from "../commands.js";
import { MenuView } from "./MenuView.js";
import {
  PlayerNameView,
  type PlayerNameViewOptions,
} from "./PlayerNameView.js";
import { PlayerView } from "./PlayerView.js";
import { SubmenuView } from "./SubmenuView.js";
import { SetupView, type SetupViewOptions } from "./SetupView.js";

export class App {
  private readonly player: PlayerView;
  private readonly menu: MenuView;
  private readonly submenu: SubmenuView;
  private readonly setup: SetupView;
  private readonly playerName: PlayerNameView;
  private activeView: ViewId;
  private controlledPlayer?: {
    readonly playerId: string;
    readonly volumeLevel: number;
    readonly volumeMuted: boolean;
  };

  constructor(
    private readonly renderer: CliRenderer,
    theme: Theme,
    strings: Locale,
    registry: MenuRegistry,
    initialView: "player" | "menu" | "setup" = "player",
    projection?: PlayerProjection,
    private readonly onQuit?: () => void,
    private onPlayerCommand?: (
      command: string,
      args: Readonly<Record<string, unknown>>,
    ) => void,
    setupOptions?: SetupViewOptions,
    playerNameOptions?: Omit<PlayerNameViewOptions, "onBack">,
  ) {
    this.player = new PlayerView(renderer, theme, strings, playerHelp(strings));
    this.menu = new MenuView(renderer, theme, strings, {
      items: registry.mainMenuItems,
      onSelect: (item) => this.dispatch(item.action),
      onBack: () => this.show("player"),
    });
    this.submenu = new SubmenuView(renderer, theme, strings, {
      submenus: registry.submenus,
      submenuTitles: registry.submenuTitles,
      rootTitle: strings.app.name,
      onAction: (item) => this.dispatch(item.action),
      onBack: () => this.show("menu"),
    });
    this.setup = new SetupView(renderer, theme, strings, {
      onSubmit: async () => {},
      ...setupOptions,
    });
    this.playerName = new PlayerNameView(renderer, theme, strings, {
      initialName: playerNameOptions?.initialName ?? strings.app.name,
      onSubmit: playerNameOptions?.onSubmit ?? (async () => {}),
      onBack: () => this.show("submenu"),
    });
    this.activeView = initialView;
    if (projection) this.updatePlayer(projection);
    this.show(initialView);
    renderer.keyInput.on("keypress", (key) => this.handleKeyPress(key));
  }

  private handleKeyPress(key: KeyEvent): void {
    if (key.ctrl && key.name === "c") {
      this.onQuit?.();
      return;
    }
    if (this.activeView === "setup") {
      this.setup.handleKeyPress(key);
      return;
    }
    if (this.activeView === "playerName") {
      this.playerName.handleKeyPress(key);
      return;
    }
    if (this.activeView === "player") {
      const projection = this.currentProjection;
      const command = projection
        ? playerCommandForKey(key, projection)
        : undefined;
      if (command) {
        const isMute = key.sequence?.toLowerCase() === "u";
        if (
          command.name === "players/cmd/volume_set" &&
          typeof command.args.volume_level === "number" &&
          projection?.player
        ) {
          this.controlledPlayer = {
            playerId: projection.player.player_id,
            volumeLevel:
              isMute && !projection.player.volume_muted
                ? (projection.player.volume_level ?? 30)
                : command.args.volume_level,
            volumeMuted: isMute ? !projection.player.volume_muted : false,
          };
          this.updatePlayer(projection);
        }
        this.onPlayerCommand?.(command.name, command.args);
        return;
      }
    }
    if (this.activeView === "menu" && key.name === "escape") {
      this.show("player");
      return;
    }
    if (
      this.activeView === "player" &&
      key.sequence?.toLowerCase() === "m" &&
      !key.ctrl &&
      !key.meta
    ) {
      queueMicrotask(() => this.show("menu"));
    }
  }

  private currentProjection?: PlayerProjection;

  updatePlayer(projection: PlayerProjection): void {
    const player = projection.player;
    const controlledPlayer = this.controlledPlayer;
    const controlled =
      player && player.player_id === controlledPlayer?.playerId
        ? {
            ...projection,
            player: {
              ...player,
              volume_level: controlledPlayer.volumeLevel,
              volume_muted: controlledPlayer.volumeMuted,
            },
          }
        : projection;
    this.currentProjection = controlled;
    this.player.update(controlled);
  }

  setPlayerCommandHandler(
    handler: (command: string, args: Readonly<Record<string, unknown>>) => void,
  ): void {
    this.onPlayerCommand = handler;
  }

  showPlayer(): void {
    this.show("player");
  }

  private dispatch(action: MenuAction): void {
    switch (action.type) {
      case "noop":
        return;
      case "submenu":
        this.submenu.openSubmenu(action.menuId);
        this.show("submenu");
        return;
      case "quit":
        this.onQuit?.();
        return;
      case "editPlayerName":
        this.show("playerName");
    }
  }

  private show(view: ViewId): void {
    this.player.setVisible(view === "player");
    this.menu.setVisible(view === "menu");
    this.submenu.setVisible(view === "submenu");
    this.setup.setVisible(view === "setup");
    this.playerName.setVisible(view === "playerName");
    this.activeView = view;
    this.renderer.setTerminalTitle(
      view === "player"
        ? "Music Assistant TUI"
        : `Music Assistant TUI - ${view}`,
    );
    if (view === "menu") this.menu.resetAndFocus();
    if (view === "submenu") this.submenu.resetAndFocus();
  }
}
