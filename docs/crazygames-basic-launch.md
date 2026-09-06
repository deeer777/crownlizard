# Crown Lizard — CrazyGames Basic Launch

This launch lane is intentionally isolated from the production build at crownlizard.com. Work on it belongs on `codex/crazygames-platform`; do not deploy it with the Crown production command.

## Create the upload package

Run:

```powershell
npm run package:crazygames
```

The command rebuilds `dist-crazygames/`, runs the blocking portal QA gate, then creates a deterministic ZIP and SHA-256 file in `artifacts/`. `index.html` is at the archive root.

The QA gate checks the 250 MiB / 1,500-file total limits, estimates the initial download, requires the official CrazyGames HTML5 v3 SDK, requires relative bundle paths, and rejects Crown-only hosting, PWA, account, AdSense and service-worker integrations.

## Manual preview gate

Before uploading a new revision:

1. Extract the generated ZIP to a clean folder and serve that exact folder over HTTP.
   The repository's local verification flow uses `npm run preview:crazygames` after extraction.
2. Test Chrome and Edge at desktop and mobile viewport sizes.
3. Verify START GAME, tutorial, pause/resume, dash, keyboard, pointer steering, touch steering, audio mute, death, retry and return to menu.
4. Confirm one `gameplayStart` is sent only when play begins and `gameplayStop` is sent for pause, overlays and run end.
5. Test the uploaded package again with the CrazyGames Developer Portal Preview. That preview is the acceptance authority; the local SDK environment is only a preflight.
6. Keep every ad entry point absent during Basic Launch. CrazyGames disables ads during this measurement phase.

## Submission material

Portal copy and technical facts live in `platforms/crazygames-submission.json` so they can be versioned separately from the Crown website.

Prepared in `submissions/crazygames/media/`:

- landscape cover, 1920x1080;
- portrait cover, 800x1200;
- square cover, 800x800;

Still required in the Developer Portal:

- silent landscape preview, 1080p 16:9 and 15–20 seconds;
- silent portrait preview, 1080p 2:3 and 15–20 seconds.

Use `submissions/crazygames/preview-shot-list.md` for the honest gameplay capture and run `npm run qa:crazygames:submission` before upload.

Use a consistent Crown Lizard visual across all three covers. Only the game title may appear as promotional copy. Do not use borders, store logos, blurry art or a plain gameplay screenshot.

## Basic Launch targets

- The measurement normally needs at least 500 plays over 7 days and can run for up to 21 days.
- Aim for at least 80% play conversion, 10+ minutes average playtime and 10–15% day-one retention.
- The platform permits 50 MiB initial download; 20 MiB is the target for mobile-homepage eligibility.
- Do not optimize the Crown build around portal metrics. Improve shared gameplay in source, then validate both platform builds independently.
