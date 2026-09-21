import { describe, expect, test } from "bun:test";
import { en } from "../src/i18n/en.js";
import { buildMenu } from "../src/menu.js";
import { twoPhaseSearch } from "../src/search.js";

describe("menu", () => {
  test("has unique registered items and a settings submenu", () => {
    const menu = buildMenu(en);
    expect(menu.menuItemsById.size).toBe(7);
    expect(menu.submenus.get("settings")?.[0]?.id).toBe("settings.playerName");
    expect(menu.mainMenuItems.at(-1)?.action).toEqual({ type: "quit" });
  });

  test("search is accent insensitive", () => {
    const items = [{ name: "Beyonce" }, { name: "Björk" }];
    expect(
      twoPhaseSearch(items, "bjork", (item) => [item.name], ["name"]),
    ).toEqual([{ name: "Björk" }]);
  });

  test("fuzzy multi-term search accepts weighted keys", () => {
    const items = [
      { name: "Music Assistant", description: "Terminal player" },
      { name: "Settings", description: "Configuration" },
    ];

    expect(
      twoPhaseSearch(
        items,
        "Assistent Terminol",
        (item) => [item.name, item.description],
        [{ name: "name", weight: 2 }, "description"],
      ),
    ).toEqual([items[0]]);
  });
});
