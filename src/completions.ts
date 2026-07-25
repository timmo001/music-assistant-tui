const shells = ["bash", "fish", "zsh"] as const;
export type CompletionShell = (typeof shells)[number];

export function parseCompletionShell(args: readonly string[]): CompletionShell {
  const shell = args.find((arg) => !arg.startsWith("-")) ?? "zsh";
  if (shells.some((candidate) => candidate === shell))
    return shell as CompletionShell;
  throw new Error(
    `Unsupported shell '${shell}' (expected: ${shells.join(", ")})`,
  );
}

export function renderCompletions(shell: CompletionShell): string {
  switch (shell) {
    case "bash":
      return `# bash completion for music-assistant-tui
_music_assistant_tui() {
  COMPREPLY=( $(compgen -W "menu completions --help" -- "${"$"}{COMP_WORDS[COMP_CWORD]}") )
}
complete -F _music_assistant_tui music-assistant-tui
`;
    case "fish":
      return `complete -c music-assistant-tui -f
complete -c music-assistant-tui -a menu -d 'Open the secondary menu'
complete -c music-assistant-tui -a completions -d 'Print shell completions'
`;
    case "zsh":
      return `#compdef music-assistant-tui
_arguments '1:command:(menu completions)' '*:shell:(bash fish zsh)'
`;
  }
}
