import type { Locale } from "./types.js";

export const en: Locale = {
  app: {
    name: "Music Assistant TUI",
    playerPlaceholder: "Player view not implemented yet",
  },
  menu: {
    title: "Menu",
    library: "Library",
    search: "Search",
    players: "Players",
    settings: "Settings",
    about: "About",
    quit: "Quit",
    placeholder: "Not implemented yet",
  },
  help: {
    menu: "menu",
    navigate: "navigate",
    select: "select",
    filter: "filter",
    back: "back",
    quit: "quit",
  },
  keys: {
    arrowsUD: "Up/Down",
    enter: "Enter",
    typeInput: "Type",
    esc: "Esc",
    backspace: "Backspace",
    ctrl: { c: "Ctrl+C" },
    m: "m",
  },
};
