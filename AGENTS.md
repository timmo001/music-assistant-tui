# Music Assistant TUI

`music-assistant-tui` is a Bun and TypeScript terminal application built with OpenTUI and Effect v4.

## Source Of Truth

Check local code first, then use these references in order:

1. `@models` for Music Assistant wire models.
2. `@client` for API commands and connection behaviour.
3. `@frontend` for existing client behaviour.
4. `@sendspin` for the Sendspin protocol.
5. `@home-assistant-tui` only for generic TUI and packaging patterns.

Do not copy Home Assistant entities, services, authentication, configuration, views, or terminology into this repository.

## Architecture

- `src/tui/PlayerView.ts` is the entry view. It remains a placeholder until player work begins.
- `src/tui/MenuView.ts` and `SubmenuView.ts` provide the secondary menu opened with `m`.
- `src/music-assistant/` and `src/sendspin/` contain pure schemas and helpers. They do not own transports.
- External payloads are decoded with Effect Schema. Do not use casts to bypass validation.

## Commands

```sh
mise run dev
mise run serve:start
mise run serve:show
mise run serve:stop
mise run check
mise run package:arch
```

OpenTUI requires a real PTY. Use the `serve:*` tasks and Terminal Control for interactive checks.
