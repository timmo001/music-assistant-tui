import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { en } from "../src/i18n/en.js";
import { buildMenu } from "../src/menu.js";
import { DEFAULT_THEME } from "../src/theme.js";
import { App } from "../src/tui/App.js";

test("opens the menu from the player and returns", async () => {
  const { renderer, mockInput, renderOnce, captureCharFrame } =
    await createTestRenderer({ width: 80, height: 24 });

  try {
    new App(renderer, DEFAULT_THEME, en, buildMenu(en));
    await renderOnce();
    expect(captureCharFrame()).toContain(en.app.playerPlaceholder);

    mockInput.pressKey("m");
    await Promise.resolve();
    await renderOnce();
    expect(captureCharFrame()).toContain(en.menu.library);
    expect(captureCharFrame()).not.toContain("/ m");
  } finally {
    renderer.destroy();
  }
});
