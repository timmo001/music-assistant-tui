import type { Locale } from "./types.js";

export const en: Locale = {
  app: {
    name: "Music Assistant TUI",
    nothingPlaying: "Nothing playing",
    terminalTooSmall: "Terminal too small (minimum 40x10)",
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
    playPause: "play/pause",
    previous: "previous",
    next: "next",
    volumeDown: "volume down",
    volumeUp: "volume up",
    mute: "mute",
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
