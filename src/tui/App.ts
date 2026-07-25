import type { CliRenderer, KeyEvent } from "@opentui/core";
import type { Locale } from "../i18n/index.js";
import type { MenuRegistry } from "../menu.js";
import type { Theme } from "../theme.js";
import type { MenuAction, ViewId } from "../types.js";
import type { PlayerProjection } from "../player.js";
import { playerCommandForKey, playerHelp } from "../commands.js";
import { MenuView } from "./MenuView.js";
import { PlayerView } from "./PlayerView.js";
import { SubmenuView } from "./SubmenuView.js";

export class App {
  private readonly player: PlayerView;
  private readonly menu: MenuView;
  private readonly submenu: SubmenuView;
  private activeView: ViewId;

  constructor(
    private readonly renderer: CliRenderer,
    theme: Theme,
    strings: Locale,
    registry: MenuRegistry,
    initialView: "player" | "menu" = "player",
    projection?: PlayerProjection,
    private readonly onQuit?: () => void,
    private onPlayerCommand?: (
      command: string,
      args: Readonly<Record<string, unknown>>,
    ) => void,
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
    this.activeView = initialView;
    if (projection) this.updatePlayer(projection);
    this.show(initialView);
    renderer.keyInput.on("keypress", (key) => this.handleKeyPress(key));
  }

  private handleKeyPress(key: KeyEvent): void {
    if (this.activeView === "player") {
      const command = this.currentProjection
        ? playerCommandForKey(key, this.currentProjection)
        : undefined;
      if (command) {
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
    this.currentProjection = projection;
    this.player.update(projection);
  }

  setPlayerCommandHandler(
    handler: (command: string, args: Readonly<Record<string, unknown>>) => void,
  ): void {
    this.onPlayerCommand = handler;
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
    }
  }

  private show(view: ViewId): void {
    this.player.setVisible(view === "player");
    this.menu.setVisible(view === "menu");
    this.submenu.setVisible(view === "submenu");
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
