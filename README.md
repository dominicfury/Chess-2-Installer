# Battle Chess Casino: Rave Edition

Chess, but every capture is a gunfight. Play your hand, keep the beat, hold your ground.

Battle Chess Casino: Rave Edition is a Windows desktop game, played through this desktop app; it is
headed for Steam.

## Install

Download **Battle Chess Casino Setup** from the [latest release](https://github.com/dominicfury/Chess-2-Installer/releases/latest)
and run it. The setup wizard lets you pick where to install, then puts Battle Chess Casino on the desktop
and in the Start menu and offers to launch it. Windows may show "Windows protected your PC" because the installer is not signed:
choose **More info → Run anyway**.

Then open it and press Play: **Solo** is the casino campaign, **Multiplayer** has ranked, rooms
for friends and joining by code (set a name in Settings first). You need a keyboard and mouse for the duels.

## What this repository is

The desktop shell: the window, an offline page, the icon and the auto-updater. The game itself is
built in the private `chess2` workspace and copied into `game/` at build time
(`node tools/bundle-desktop.mjs` there); `game/` is not committed. The app runs the game from its
own files and goes to the server only for online play (ranked, friend rooms, the leaderboard).

The app updates itself from this repository's releases: it checks on launch, downloads a newer
version in the background and installs it when the player quits (or from the game's "Restart now").
Because the game ships inside the app, every game change is a new release.

- `server.json` tells every installed app where the server is. Apps read it from this repository
  at launch, so changing the server never needs a new installer.
- `main.js`, `preload.js`, `offline.html` are the shell. `app-config.json` is the built-in
  fallback address.

## Building the installer

1. Bump `version` in `package.json`.
2. In the `chess2` workspace: `node tools/bundle-desktop.mjs` (fills `game/` here).
3. Here:

```
npm install
npm run dist          →  dist/Battle-Chess-Casino-Setup-<version>.exe, .exe.blockmap, latest.yml
```

4. Create a GitHub Release tagged `v<version>`, attach the `.exe`, the `.exe.blockmap` and
   `latest.yml`, and publish it (not a draft). Installed apps read `latest.yml` to find the update;
   the install link above always points at the newest release.

To run the shell against a local server while developing the game: `npm run start:local`.

## License

Battle Chess Casino: Rave Edition is copyright © 2026 Dominic Chase. All rights reserved.

This repository is public so that players can download the installer and so installed copies can
read the current server address. **It is not open source.** You may download and run the official
installer to play; you may not redistribute it, repackage it, ship a modified build, or distribute
anything derived from this source. See [LICENSE](LICENSE).
