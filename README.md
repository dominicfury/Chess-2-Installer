# Chess 2

Chess, but every capture is a gunfight. Play your hand, keep the beat, hold your ground.

## Install

Download **Chess 2 Setup** from the [latest release](https://github.com/dominicfury/Chess-2-Installer/releases/latest)
and run it. The setup wizard lets you pick where to install, then puts Chess 2 on the desktop
and in the Start menu and offers to launch it. Windows may show "Windows protected your PC" because the installer is not signed:
choose **More info → Run anyway**.

Then open Chess 2, enter a name, and either create a room and send the invite link to a friend,
or play against the bot. You need a keyboard and mouse for the duels.

## What this repository is

Only the desktop shell: a window that opens the game from the server, an offline page, and the
icon. The game itself lives on the server and is not in this repository.

- `server.json` tells every installed app where the server is. Apps read it from this repository
  at launch, so changing the server never needs a new installer.
- `main.js`, `preload.js`, `offline.html` are the shell. `app-config.json` is the built-in
  fallback address.

## Building the installer

```
npm install
npm run dist          →  dist/Chess 2 Setup <version>.exe
```

Bump `version` in `package.json` first. Then create a GitHub Release tagged `v<version>` and
attach the exe; the install link above always points at the newest release.

To run the shell against a local server while developing the game: `npm run start:local`.

## License

Chess 2 is copyright © 2026 Dominic Chase. All rights reserved.

This repository is public so that players can download the installer and so installed copies can
read the current server address. **It is not open source.** You may download and run the official
installer to play; you may not redistribute it, repackage it, ship a modified build, or distribute
anything derived from this source. See [LICENSE](LICENSE).
