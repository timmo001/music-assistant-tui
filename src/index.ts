import { createCliRenderer } from "@opentui/core";
import { Deferred, Effect, Stream, SubscriptionRef } from "effect";
import { renderCompletions, parseCompletionShell } from "./completions.js";
import {
  type ConnectionConfig,
  loadConfig,
  saveConnectionConfig,
} from "./config.js";
import { parseFlags, printHelp } from "./flags.js";
import { Strings } from "./i18n/index.js";
import { buildMenu } from "./menu.js";
import {
  discoverServers,
  MusicAssistantClient,
  selectServer,
} from "./music-assistant/index.js";
import { projectPlayer } from "./player.js";
import { SendspinProcess } from "./sendspin/index.js";
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
      const quit = yield* Deferred.make<void>();
      const renderer = yield* Effect.acquireRelease(
        Effect.promise(() =>
          createCliRenderer({
            screenMode: "alternate-screen",
            exitOnCtrlC: false,
            useMouse: false,
            backgroundColor: theme.bg,
          }),
        ),
        (renderer) => Effect.sync(() => renderer.destroy()),
      );
      const config = yield* loadConfig();
      const connection = yield* Deferred.make<ConnectionConfig>();
      const context = yield* Effect.context<never>();
      const needsSetup = config.token === undefined;
      const app = new App(
        renderer,
        theme,
        strings,
        buildMenu(strings),
        needsSetup ? "setup" : flags.initialView,
        undefined,
        () => Deferred.doneUnsafe(quit, Effect.void),
        undefined,
        {
          initialServerUrl: config.serverUrl,
          onSubmit: async (values) => {
            await Effect.runPromiseWith(context)(
              saveConnectionConfig(config.path, values),
            );
            Deferred.doneUnsafe(connection, Effect.succeed(values));
          },
        },
      );
      renderer.start();

      const configuredConnection = needsSetup
        ? yield* Deferred.await(connection)
        : {
            ...(config.serverUrl ? { serverUrl: config.serverUrl } : {}),
            token: config.token,
          };
      if (needsSetup) app.showPlayer();
      const discovered = configuredConnection.serverUrl
        ? []
        : yield* discoverServers().pipe(
            Effect.catchTag("DiscoveryError", (error) =>
              Effect.logWarning(error.message).pipe(Effect.as([])),
            ),
          );
      const serverUrl = yield* selectServer(
        configuredConnection.serverUrl,
        discovered,
      );

      const musicAssistant = yield* MusicAssistantClient.connect({
        serverUrl,
        token: configuredConnection.token,
      });
      const sendspin = yield* SendspinProcess.make(config.sendspinBinary);
      yield* sendspin
        .start({
          serverUrl,
          playerId: config.sendspinPlayerId,
          playerName: config.playerName,
          volume: config.volume,
        })
        .pipe(
          Effect.catchTag("SendspinProcessError", (error) =>
            Effect.logWarning(error.message),
          ),
        );

      let musicState = yield* SubscriptionRef.get(musicAssistant.state);
      let processState = yield* SubscriptionRef.get(sendspin.status);
      const renderPlayer = () =>
        app.updatePlayer(
          projectPlayer(musicState, processState, config.sendspinPlayerId),
        );
      app.updatePlayer(
        projectPlayer(musicState, processState, config.sendspinPlayerId),
      );

      yield* SubscriptionRef.changes(musicAssistant.state).pipe(
        Stream.runForEach((state) =>
          Effect.sync(() => {
            musicState = state;
            renderPlayer();
          }),
        ),
        Effect.forkScoped,
      );
      yield* SubscriptionRef.changes(sendspin.status).pipe(
        Stream.runForEach((state) =>
          Effect.sync(() => {
            processState = state;
            renderPlayer();
          }),
        ),
        Effect.forkScoped,
      );
      yield* Stream.tick("1 second").pipe(
        Stream.runForEach(() => Effect.sync(renderPlayer)),
        Effect.forkScoped,
      );
      app.setPlayerCommandHandler((command, args) => {
        Effect.runForkWith(context)(
          musicAssistant
            .command(command, args)
            .pipe(
              Effect.catchTag("MusicAssistantError", (error) =>
                Effect.logWarning(error.message),
              ),
            ),
        );
      });
      return yield* Deferred.await(quit);
    }),
  );

  Effect.runPromise(program).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
