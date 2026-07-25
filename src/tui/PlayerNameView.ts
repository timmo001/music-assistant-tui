import {
  bold,
  BoxRenderable,
  type CliRenderer,
  fg,
  InputRenderable,
  InputRenderableEvents,
  type KeyEvent,
  t,
  TextRenderable,
} from "@opentui/core";
import type { Locale } from "../i18n/index.js";
import type { Theme } from "../theme.js";
import { formatHelpBar, globalHelp } from "./helpBar.js";

export interface PlayerNameViewOptions {
  readonly initialName: string;
  readonly onSubmit: (name: string) => Promise<void>;
  readonly onBack: () => void;
}

export class PlayerNameView {
  private readonly root: BoxRenderable;
  private readonly input: InputRenderable;
  private readonly status: TextRenderable;
  private submitting = false;

  constructor(
    renderer: CliRenderer,
    private readonly theme: Theme,
    private readonly strings: Locale,
    private readonly options: PlayerNameViewOptions,
  ) {
    this.root = new BoxRenderable(renderer, {
      id: "player-name-root",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      justifyContent: "center",
      padding: 2,
    });
    this.root.add(
      new TextRenderable(renderer, {
        id: "player-name-title",
        content: t`${bold(fg(theme.accent)(strings.playerName.title))}`,
        marginBottom: 2,
      }),
    );
    this.root.add(
      new TextRenderable(renderer, {
        id: "player-name-label",
        content: t`${fg(theme.accent)(strings.playerName.label)}`,
      }),
    );
    this.input = new InputRenderable(renderer, {
      id: "player-name-input",
      value: options.initialName,
      width: "100%",
      maxLength: 128,
      backgroundColor: theme.bgInput,
      focusedBackgroundColor: theme.bgSelected,
      textColor: theme.fg,
      focusedTextColor: theme.fg,
      cursorColor: theme.accent,
      marginBottom: 1,
    });
    this.input.on(InputRenderableEvents.ENTER, () => this.submit());
    this.status = new TextRenderable(renderer, {
      id: "player-name-status",
      content: "",
      marginTop: 1,
    });
    this.root.add(this.input);
    this.root.add(this.status);
    this.root.add(
      new TextRenderable(renderer, {
        id: "player-name-help",
        content: formatHelpBar(theme, [
          { key: strings.keys.enter, action: strings.playerName.save },
          { key: strings.keys.esc, action: strings.help.back },
          ...globalHelp(strings),
        ]),
        marginTop: 1,
      }),
    );
    renderer.root.add(this.root);
    this.root.visible = false;
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
    if (visible) {
      this.status.content = "";
      this.input.focus();
    } else {
      this.input.blur();
    }
  }

  handleKeyPress(key: KeyEvent): boolean {
    if (this.submitting) return true;
    if (key.name === "escape") {
      this.options.onBack();
      return true;
    }
    return false;
  }

  private submit(): void {
    const name = this.input.value.trim();
    if (!name) {
      this.status.content = t`${fg(this.theme.red)(this.strings.playerName.required)}`;
      return;
    }

    this.submitting = true;
    this.status.content = t`${fg(this.theme.yellow)(this.strings.playerName.saving)}`;
    this.options.onSubmit(name).then(
      () => {
        this.submitting = false;
        this.status.content = "";
        this.options.onBack();
      },
      () => {
        this.submitting = false;
        this.status.content = t`${fg(this.theme.red)(this.strings.playerName.saveFailed)}`;
      },
    );
  }
}
