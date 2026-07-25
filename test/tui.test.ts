import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { en } from "../src/i18n/en.js";
import { buildMenu } from "../src/menu.js";
import { DEFAULT_THEME } from "../src/theme.js";
import { App } from "../src/tui/App.js";
import { projectPlayer } from "../src/player.js";

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
