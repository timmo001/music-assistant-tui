import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  t,
  bold,
  fg,
} from "@opentui/core";
import type { Locale } from "../i18n/index.js";
import type { Theme } from "../theme.js";
import { formatHelpBar, globalHelp } from "./helpBar.js";

export class PlayerView {
  private readonly root: BoxRenderable;

  constructor(renderer: CliRenderer, theme: Theme, strings: Locale) {
    this.root = new BoxRenderable(renderer, {
      id: "player-root",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: 1,
    });
    this.root.add(
      new TextRenderable(renderer, {
        id: "player-title",
        content: t`${bold(fg(theme.accent)(strings.app.name))}`,
      }),
    );
    this.root.add(
      new TextRenderable(renderer, {
        id: "player-placeholder",
        content: t`${fg(theme.fgMuted)(strings.app.playerPlaceholder)}`,
        marginTop: 1,
      }),
    );
    this.root.add(
      new TextRenderable(renderer, {
        id: "player-help",
        content: formatHelpBar(theme, [
          { key: strings.keys.m, action: strings.help.menu },
          ...globalHelp(strings),
        ]),
        marginTop: 2,
      }),
    );
    renderer.root.add(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }
}
