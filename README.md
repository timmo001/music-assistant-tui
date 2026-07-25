# Music Assistant TUI

A terminal client framework for [Music Assistant](https://www.music-assistant.io/), built with [OpenTUI](https://github.com/anomalyco/opentui) and [Effect](https://effect.website/).

This repository currently provides the application shell, protocol schemas, tests, and Linux packaging. Music playback, server connections, authentication, and Sendspin transport are not implemented yet.

## Run

```sh
mise run dev
```

The placeholder player is the entry view. Press `m` to open the secondary menu, `Escape` to return, or `Ctrl+C` to exit.

## Check And Build

```sh
mise run check
mise run build
```

The standalone binary is written to `dist/music-assistant-tui`.

## Packages

Stable `YYYYMMDD.X` releases produce Linux x86_64 and aarch64 archives, debs, RPMs, checksums, and the AUR package `music-assistant-tui`. Every push to `main` publishes `music-assistant-tui-git`.

This project was initially adapted from `home-assistant-tui` and retains only its generic terminal UI and packaging patterns.
