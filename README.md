# Music Assistant TUI

A terminal client for [Music Assistant](https://www.music-assistant.io/), built with [OpenTUI](https://github.com/anomalyco/opentui) and [Effect](https://effect.website/).

It connects to the Music Assistant WebSocket API for player, queue, metadata, and control state. Synchronized local playback is provided by the pinned [`sendspin-rs-cli`](https://github.com/s3than/sendspin-rs-cli) binary and follows the system's default audio route, normally PipeWire on Linux desktops.

## Configuration

Set the Music Assistant token before starting:

```sh
export MUSIC_ASSISTANT_TOKEN=your-token
export MUSIC_ASSISTANT_URL=http://homeassistant.local:8095 # optional; otherwise mDNS discovery is used
mise run dev
```

Persistent settings are read from `${XDG_CONFIG_HOME:-~/.config}/music-assistant-tui/config.json`. A token stored there requires file mode `0600`. Supported fields are `serverUrl`, `token`, `sendspinPlayerId`, `playerName`, `volume`, and `sendspinBinary`.

Development playback requires `sendspin-rs-cli` on `PATH` or `SENDSPIN_PLAYER_BINARY` pointing to its v0.0.8 binary. Packaged releases install the pinned binary automatically. The player currently connects directly to port `8927`, so the Music Assistant host must be locally reachable; proxy-only remote playback is not yet available.

## Run

```sh
mise run dev
```

The player is the entry view. Use `Space` for play/pause, `<` and `>` for tracks, `-` and `+` for volume, `u` for mute, `m` for the menu, or `Ctrl+C` to exit. Sendspin logs are written under `${XDG_STATE_HOME:-~/.local/state}/music-assistant-tui/`.

## Check And Build

```sh
mise run check
mise run build
```

The standalone binary is written to `dist/music-assistant-tui`.

## Packages

Stable `YYYYMMDD.X` releases produce Linux x86_64 and aarch64 archives, debs, RPMs, checksums, and the AUR package `music-assistant-tui`. Every push to `main` publishes `music-assistant-tui-git`.
