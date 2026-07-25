import { describe, expect, test } from "bun:test";
import { renderCompletions } from "../src/completions.js";
import { parseFlags } from "../src/flags.js";

describe("CLI", () => {
  test("starts on the player", () => {
    expect(parseFlags([]).initialView).toBe("player");
  });

  test("can start on the menu", () => {
    expect(parseFlags(["menu"]).initialView).toBe("menu");
  });

  test.each(["bash", "fish", "zsh"] as const)(
    "renders %s completions",
    (shell) => {
      expect(renderCompletions(shell)).toContain("music-assistant-tui");
      expect(renderCompletions(shell)).not.toContain("home-assistant");
    },
  );
});
