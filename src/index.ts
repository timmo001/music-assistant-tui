import { createCliRenderer } from "@opentui/core";
import { Effect } from "effect";
import { renderCompletions, parseCompletionShell } from "./completions.js";
import { parseFlags, printHelp } from "./flags.js";
import { Strings } from "./i18n/index.js";
import { buildMenu } from "./menu.js";
import { loadTheme } from "./theme.js";
import { App } from "./tui/App.js";

const flags = parseFlags(process.argv.slice(2));

if (flags.help) {
  printHelp();
} else if (flags.completions) {
  try {
    process.stdout.write(renderCompletions(parseCompletionShell(flags.rest)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
} else {
  const program = Effect.scoped(
    Effect.gen(function* () {
      const strings = yield* Strings;
      const theme = yield* loadTheme;
      const renderer = yield* Effect.acquireRelease(
        Effect.promise(() =>
          createCliRenderer({
            screenMode: "alternate-screen",
            exitOnCtrlC: true,
            useMouse: false,
            backgroundColor: theme.bg,
          }),
        ),
        (renderer) => Effect.sync(() => renderer.destroy()),
      );
      new App(renderer, theme, strings, buildMenu(strings), flags.initialView);
      renderer.start();
      return yield* Effect.never;
    }),
  );

  Effect.runPromise(program).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
