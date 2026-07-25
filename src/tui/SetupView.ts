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
import type { ConnectionConfig } from "../config.js";
import type { Locale } from "../i18n/index.js";
import type { Theme } from "../theme.js";
import { formatHelpBar, globalHelp } from "./helpBar.js";

export interface SetupViewOptions {
  readonly initialServerUrl?: string;
  readonly onSubmit: (config: ConnectionConfig) => Promise<void>;
}

type Field = "serverUrl" | "token";

export class SetupView {
  private readonly root: BoxRenderable;
  private readonly serverUrlInput: InputRenderable;
  private readonly tokenInput: InputRenderable;
  private readonly serverUrlLabel: TextRenderable;
  private readonly tokenLabel: TextRenderable;
  private readonly status: TextRenderable;
  private activeField: Field = "serverUrl";
  private submitting = false;

  constructor(
    renderer: CliRenderer,
    private readonly theme: Theme,
    private readonly strings: Locale,
    private readonly options: SetupViewOptions,
  ) {
    this.root = new BoxRenderable(renderer, {
      id: "setup-root",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      justifyContent: "center",
      padding: 2,
    });
    this.root.add(
      new TextRenderable(renderer, {
        id: "setup-title",
        content: t`${bold(fg(theme.accent)(strings.setup.title))}`,
        marginBottom: 1,
      }),
    );
    this.root.add(
      new TextRenderable(renderer, {
        id: "setup-subtitle",
        content: t`${fg(theme.fgMuted)(strings.setup.subtitle)}`,
        marginBottom: 2,
      }),
    );
    this.serverUrlLabel = new TextRenderable(renderer, {
      id: "setup-url-label",
      content: "",
    });
    this.serverUrlInput = new InputRenderable(renderer, {
      id: "setup-url-input",
      value: options.initialServerUrl ?? "",
      placeholder: strings.setup.urlPlaceholder,
      width: "100%",
      maxLength: 2048,
      backgroundColor: theme.bgInput,
      focusedBackgroundColor: theme.bgSelected,
      textColor: theme.fg,
      focusedTextColor: theme.fg,
      cursorColor: theme.accent,
      marginBottom: 1,
    });
    this.tokenLabel = new TextRenderable(renderer, {
      id: "setup-token-label",
      content: "",
    });
    this.tokenInput = new InputRenderable(renderer, {
      id: "setup-token-input",
      placeholder: strings.setup.tokenPlaceholder,
      width: "100%",
      maxLength: 4096,
      backgroundColor: theme.bgInput,
      focusedBackgroundColor: theme.bgSelected,
      textColor: theme.fg,
      focusedTextColor: theme.fg,
      cursorColor: theme.accent,
      marginBottom: 1,
    });
    this.serverUrlInput.on(InputRenderableEvents.ENTER, () => {
      this.activeField = "token";
      this.updateFocus();
    });
    this.tokenInput.on(InputRenderableEvents.ENTER, () => this.submit());
    this.status = new TextRenderable(renderer, {
      id: "setup-status",
      content: "",
      marginTop: 1,
    });
    this.root.add(this.serverUrlLabel);
    this.root.add(this.serverUrlInput);
    this.root.add(this.tokenLabel);
    this.root.add(this.tokenInput);
    this.root.add(this.status);
    this.root.add(
      new TextRenderable(renderer, {
        id: "setup-help",
        content: formatHelpBar(theme, [
          { key: strings.keys.tab, action: strings.setup.nextField },
          { key: strings.keys.enter, action: strings.setup.save },
          ...globalHelp(strings),
        ]),
        marginTop: 1,
      }),
    );
    renderer.root.add(this.root);
    this.root.visible = false;
    this.updateFocus();
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
    if (visible) this.resetAndFocus();
    else {
      this.serverUrlInput.blur();
      this.tokenInput.blur();
    }
  }

  handleKeyPress(key: KeyEvent): boolean {
    if (this.submitting) return true;
    if (key.name === "tab") {
      this.activeField =
        this.activeField === "serverUrl" ? "token" : "serverUrl";
      this.updateFocus();
      return true;
    }
    return false;
  }

  private resetAndFocus(): void {
    this.activeField = "serverUrl";
    this.status.content = "";
    this.updateFocus();
  }

  private updateFocus(): void {
    const serverUrlActive = this.activeField === "serverUrl";
    if (serverUrlActive) {
      this.serverUrlInput.focus();
      this.tokenInput.blur();
    } else {
      this.serverUrlInput.blur();
      this.tokenInput.focus();
    }
    this.serverUrlLabel.content = t`${fg(serverUrlActive ? this.theme.accent : this.theme.fgMuted)(this.strings.setup.urlLabel)}`;
    this.tokenLabel.content = t`${fg(serverUrlActive ? this.theme.fgMuted : this.theme.accent)(this.strings.setup.tokenLabel)}`;
  }

  private submit(): void {
    const serverUrl = this.serverUrlInput.value.trim();
    const token = this.tokenInput.value.trim();
    if (!token) {
      this.status.content = t`${fg(this.theme.red)(this.strings.setup.tokenRequired)}`;
      return;
    }
    if (serverUrl) {
      try {
        const url = new URL(serverUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw url;
      } catch {
        this.status.content = t`${fg(this.theme.red)(this.strings.setup.urlInvalid)}`;
        return;
      }
    }

    this.submitting = true;
    this.status.content = t`${fg(this.theme.yellow)(this.strings.setup.saving)}`;
    this.options.onSubmit({ ...(serverUrl ? { serverUrl } : {}), token }).then(
      () => {
        this.submitting = false;
        this.status.content = "";
      },
      () => {
        this.submitting = false;
        this.status.content = t`${fg(this.theme.red)(this.strings.setup.saveFailed)}`;
      },
    );
  }
}
