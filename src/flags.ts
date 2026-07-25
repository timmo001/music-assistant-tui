export interface Flags {
  readonly initialView: "player" | "menu";
  readonly help: boolean;
  readonly completions: boolean;
  readonly rest: readonly string[];
}

export function parseFlags(args: readonly string[]): Flags {
  const command = args.find((arg) => !arg.startsWith("-"));
  return {
    initialView: command === "menu" ? "menu" : "player",
    help: args.includes("--help") || args.includes("-h"),
    completions: command === "completions",
    rest: command ? args.slice(args.indexOf(command) + 1) : [],
  };
}

export function printHelp(): void {
  process.stdout.write(`Usage: music-assistant-tui [menu|completions] [options]

Launch the Music Assistant TUI. The player placeholder opens by default.

Commands:
  menu                       Open the secondary menu
  completions bash|fish|zsh  Print shell completions

Options:
  -h, --help                 Show this help message
`);
}
