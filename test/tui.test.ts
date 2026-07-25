import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { en } from "../src/i18n/en.js";
import { buildMenu } from "../src/menu.js";
import { DEFAULT_THEME } from "../src/theme.js";
import { App } from "../src/tui/App.js";
import { projectPlayer } from "../src/player.js";
import { Player } from "../src/music-assistant/models.js";

test("opens the menu from the player and returns", async () => {
  const { renderer, mockInput, renderOnce, captureCharFrame } =
    await createTestRenderer({ width: 80, height: 24 });

  try {
    new App(renderer, DEFAULT_THEME, en, buildMenu(en));
    await renderOnce();
    expect(captureCharFrame()).toContain(en.app.name);

    mockInput.pressKey("m");
    await Promise.resolve();
    await renderOnce();
    expect(captureCharFrame()).toContain(en.menu.library);
    expect(captureCharFrame()).not.toContain("/ m");
  } finally {
    renderer.destroy();
  }
});

test("renders connection and audio status", async () => {
  const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({
    width: 80,
    height: 24,
  });
  try {
    const app = new App(renderer, DEFAULT_THEME, en, buildMenu(en));
    app.updatePlayer(
      projectPlayer(
        {
          connection: { type: "disconnected", message: "offline" },
          players: new Map(),
          queues: new Map(),
        },
        { type: "exited", code: 1 },
        "missing",
      ),
    );
    await renderOnce();
    expect(captureCharFrame()).toContain("disconnected");
    expect(captureCharFrame()).toContain(en.app.nothingPlaying);
  } finally {
    renderer.destroy();
  }
});

test("collects connection settings during first-run setup", async () => {
  const { renderer, mockInput, renderOnce, captureCharFrame } =
    await createTestRenderer({ width: 80, height: 24 });
  let submitted: unknown;
  try {
    new App(
      renderer,
      DEFAULT_THEME,
      en,
      buildMenu(en),
      "setup",
      undefined,
      undefined,
      undefined,
      {
        onSubmit: async (values) => {
          submitted = values;
        },
      },
    );
    await renderOnce();
    expect(captureCharFrame()).toContain(en.setup.title);

    await mockInput.typeText("http://music.local:8095");
    mockInput.pressEnter();
    await Promise.resolve();
    await renderOnce();
    await mockInput.typeText("secret-token");
    await renderOnce();
    expect(captureCharFrame()).toContain("secret-token");
    mockInput.pressEnter();
    await Promise.resolve();
    await Promise.resolve();

    expect(submitted).toEqual({
      serverUrl: "http://music.local:8095",
      token: "secret-token",
    });
  } finally {
    renderer.destroy();
  }
});

test("routes Ctrl+C through graceful app shutdown", async () => {
  const { renderer, mockInput } = await createTestRenderer({
    width: 80,
    height: 24,
  });
  let quit = false;
  try {
    new App(
      renderer,
      DEFAULT_THEME,
      en,
      buildMenu(en),
      "player",
      undefined,
      () => {
        quit = true;
      },
    );

    mockInput.pressCtrlC();

    expect(quit).toBe(true);
  } finally {
    renderer.destroy();
  }
});

test("applies consecutive volume and mute controls optimistically", async () => {
  const { renderer, mockInput, renderOnce, captureCharFrame } =
    await createTestRenderer({ width: 80, height: 24 });
  const commands: Array<{
    command: string;
    args: Readonly<Record<string, unknown>>;
  }> = [];
  try {
    const app = new App(
      renderer,
      DEFAULT_THEME,
      en,
      buildMenu(en),
      "player",
      {
        connection: {
          type: "authenticated",
          server: {
            server_id: "server",
            server_version: "2.7.0",
            schema_version: 33,
            min_supported_schema_version: 28,
            homeassistant_addon: false,
            onboard_done: true,
            status: "running",
            has_remote_access: false,
          },
        },
        process: { type: "running", pid: 123 },
        player: Player.make({
          player_id: "player",
          provider: "sendspin",
          type: "player",
          name: "Terminal",
          available: true,
          enabled: true,
          playback_state: "playing",
          volume_level: 30,
          volume_muted: false,
          group_members: [],
          supported_features: ["volume_set", "volume_mute"],
        }),
        title: "Track",
        elapsed: 0,
      },
      undefined,
      (command, args) => commands.push({ command, args }),
    );

    mockInput.pressKey("=");
    mockInput.pressKey("=");
    mockInput.pressKey("u");
    await renderOnce();
    expect(commands.map(({ args }) => args.volume_level)).toEqual([33, 36, 0]);
    expect(captureCharFrame()).toContain("muted");

    mockInput.pressKey("u");
    await renderOnce();
    expect(commands.at(-1)?.args.volume_level).toBe(36);
    expect(captureCharFrame()).toContain("volume 36%");
  } finally {
    renderer.destroy();
  }
});
