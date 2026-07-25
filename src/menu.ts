import type { Locale } from "./i18n/index.js";
import type { MenuItem } from "./types.js";

export interface MenuRegistry {
  readonly mainMenuItems: readonly MenuItem[];
  readonly submenus: Map<string, readonly MenuItem[]>;
  readonly submenuTitles: Map<string, string>;
  readonly menuItemsById: Map<string, MenuItem>;
}

const item = (
  id: string,
  icon: string,
  title: string,
  description: string,
  action: MenuItem["action"],
  keywords?: readonly string[],
): MenuItem => ({ id, icon, title, description, action, keywords });

export function buildMenu(strings: Locale): MenuRegistry {
  const placeholder = strings.menu.placeholder;
  const mainMenuItems = [
    item("library", "L", strings.menu.library, placeholder, { type: "noop" }),
    item("search", "/", strings.menu.search, placeholder, { type: "noop" }),
    item("players", "P", strings.menu.players, placeholder, { type: "noop" }),
    item("settings", "S", strings.menu.settings, placeholder, {
      type: "submenu",
      menuId: "settings",
    }),
    item("quit", "Q", strings.menu.quit, "Exit the application", {
      type: "quit",
    }),
  ] as const;
  const settings = [
    item("settings.about", "i", strings.menu.about, placeholder, {
      type: "noop",
    }),
  ];
  const submenus = new Map<string, readonly MenuItem[]>([
    ["settings", settings],
  ]);
  const submenuTitles = new Map([["settings", strings.menu.settings]]);
  const menuItemsById = new Map<string, MenuItem>();
  for (const menuItem of [...mainMenuItems, ...settings]) {
    menuItemsById.set(menuItem.id, menuItem);
  }
  return { mainMenuItems, submenus, submenuTitles, menuItemsById };
}
