# Aether Estates

Batch 5 completes the single-page concept website below the existing four-stage cinematic hero: three illustrative residences, property details, agency philosophy, service concepts, a local-only viewing enquiry demonstration, responsive navigation, and footer. No real booking or data submission occurs.

## Local development

Use Node.js 20.19+ on the 20.x line, or 22.12+ (the setup was verified with Node 26.7.0), and npm.

```bash
cd "/Users/prathamtomar/Desktop/Pratham/Freelancing/Website/Construction"
npm install
npm run dev
```

Open the local URL printed by Vite. Stop with Ctrl+C. For reproducible installation after checkout use `npm ci`.

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
```

Edit `src/config/site.ts` for the brand and media paths, `src/config/hero-story.ts` for cinematic copy, `src/config/properties.ts` for the three concepts and photo credits, and `src/config/navigation.ts` for section links. Keep `index.html` metadata aligned when renaming the project. Cormorant Garamond and Manrope Latin WOFF2 fonts are served locally with their OFL license files under `public/fonts/`. Motion supplies a reusable progress value; Lucide supplies restrained navigation and dialog icons.

## Specification ownership

- `BRIEF.md`: product scope, content, functionality, and milestones.
- `DESIGN.md`: appearance, tokens, and responsive composition.
- `MOTION_REFERENCE.md`: scroll behavior, rendering, loading, and animation.

## Folder responsibilities

- `src/pages/`: page composition.
- `src/components/hero/`: hero composition, sequence lifecycle, manifest validation, image cache, rendering, and preference handling.
- `src/layouts/`: reserved for later UI work.
- `src/config/`: configurable content and asset references.
- `src/hooks/`, `src/types/`: reserved for shared behavior and types.
- `src/styles/`: tokens and global styles.
- `src/assets/`: future bundled assets.
- `assets/source/`: untouched source master, not shipped by Vite.
- `public/frames/`: generated JPEG sequence and verified `manifest.json`.
- `public/media/`: generated first-frame poster.
- `scripts/prepare-hero.mjs`: reproducible local media pipeline.

## Hero asset preparation

FFmpeg and ffprobe are required. On macOS with Homebrew, install them only with system-install approval:

```bash
brew install ffmpeg
```

Prepare or regenerate the assets:

```bash
npm run prepare:hero
```

The script uses `assets/source/DroneVideo.mp4` unchanged. It probes actual source metadata, samples at up to 24 FPS (without increasing a lower average source rate), preserves composition, limits output to the source resolution and 1280 px width, and writes high-quality JPEGs at FFmpeg quality 4. It does not trim, crop, sharpen, recolor, or remove the source watermark. The poster is copied from the first extracted frame without recompression; visually recheck its suitability when replacing the source.

Outputs:

- `public/frames/frame_0001.jpg` onward: sequential frames, starting at 1.
- `public/frames/manifest.json`: authoritative actual count, rate, dimensions, duration, URLs, normalized sample times, sizes, and source provenance/checksum.
- `public/media/hero-poster.jpg`: independently loadable exterior poster.

Manifest paths are public URL paths (`/frames/...`, `/media/...`), not paths containing `public/`. When deploying beneath a non-root Vite base in a later batch, resolve these paths against `import.meta.env.BASE_URL`. The manifest's `frameTimesSeconds` describes output sampling, not a claim that source timestamps are identical. `durationSeconds` describes the source video stream; container/audio duration can differ.

Each run checks tools and source before extraction, validates every JPEG by decoding, checks the full numbered sequence and dimensions, and verifies the source SHA-256 before publishing. Output staging occurs outside `public/`. The script refuses output-directory symlinks, unowned manifests/assets, and unexpected numbered JPEGs. Reruns replace only recognized previously generated frames, manifest, and poster; unrelated assets remain untouched. Ordinary publishing failures roll back the previous generated files. Avoid running builds or serving these assets during the short publication step.

A process lock prevents simultaneous runs. If forcibly interrupted, check that the PID in `.prepare-hero.lock` is no longer running before removing the stale lock. Inspect any `.hero-preparation-*` directory before cleanup; it may contain staged output or backups from an interrupted publish.

To replace the footage, supply a properly licensed source at the same configured path, rerun the command, and inspect the first/middle/last frames. The pipeline requires an SDR export for browser JPEG delivery; HDR input fails explicitly instead of applying unapproved tone mapping. No application-component rewrite is needed. The existing Gemini watermark remains visible in current source-derived assets.

See `docs/HERO_ASSETS.md` for measured source metadata, asset sizes, and verification results.

## Hero runtime and verification

The hero reads the manifest, derives the frame from actual section geometry, and paints through an event-driven requestAnimationFrame callback. It never autoplays. A bounded loader prioritizes the target and nearby frames; reduced motion and Save-Data use the poster without fetching the sequence. `docs/HERO_IMPLEMENTATION.md` documents the architecture, actual verification, and remaining limitations.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The dependency-free unit tests use Node's native TypeScript support (verified on Node 26.7.0; use a Node release supporting TypeScript stripping). Browser regression scripts use the already available Playwright CLI:

```bash
# Keep npm run dev running in another terminal.
playwright-cli -s=aether-hero open http://127.0.0.1:5173/
playwright-cli -s=aether-hero run-code --filename=tests/hero-browser.js
playwright-cli -s=aether-hero run-code --filename=tests/hero-resilience.js
playwright-cli -s=aether-hero run-code --filename=tests/hero-accessibility.js
playwright-cli -s=aether-touch open --device="iPhone 13" http://127.0.0.1:5173/
playwright-cli -s=aether-touch run-code --filename=tests/hero-touch.js
playwright-cli -s=aether-hero close
playwright-cli -s=aether-touch close
```

Browser scripts target the existing verified 240-frame fixture and a dev server on port 5173. They save local screenshots under `artifacts/` (ignored by Git). The test-only page metrics are injected by Playwright, not shipped in the application. Canvas/section data attributes expose wanted/painted indices and bounded-cache diagnostics without public UI debug text.

## Website sections and interactions

- `#properties`: three concept properties, all visibly disclosed; no prices, addresses, sale statuses, or invented listing statistics.
- `#about`: fictional agency introduction; `#approach`: proposed services.
- `#contact`: viewing invitation; legacy `#enquire` remains an alias.
- Both hero CTAs go directly to `#properties`. The hero skip link still targets the compatible `#after-hero` wrapper.
- Desktop navigation is available in the hero top bar and the sticky content header. Mobile uses an accessible native dialog menu.
- Property dialogs hand off to a preselected viewing form. Only one dialog is active. Escape, contained keyboard focus, trigger focus restoration, background scroll locking, and internal scrolling are supported.
- The form validates locally, clears values on successful demo completion and on close, and makes no submission request or persistent storage writes.

All new photographs are local responsive WebP assets. Provenance, verified licences, download commands, and attribution are in `docs/IMAGE_SOURCES.md`. The agency image is a copy of an existing source frame; the drone master and extracted sequence remain unchanged.

```bash
# Additional browser checks; run against npm run dev on port 5173.
playwright-cli -s=aether-site open http://127.0.0.1:5173/
playwright-cli -s=aether-site run-code --filename=tests/website-browser.js
playwright-cli -s=aether-site run-code --filename=tests/website-accessibility.js
playwright-cli -s=aether-site run-code --filename=tests/hero-story-browser.js
playwright-cli -s=aether-site run-code --filename=tests/hero-story-edge-browser.js
playwright-cli -s=aether-site close
```

See `docs/WEBSITE_IMPLEMENTATION.md` for Batch 5 architecture, verification, bundle measurements, screenshots, and limitations. The app is still a fictional, noindex demonstration. Batch 6 QA is documented in [docs/FINAL_QA.md](docs/FINAL_QA.md), including browser coverage, measured performance, evidence and publication limitations. Publishing requires separate approval.


## Final QA (Batch 6)

The cinematic implementation is preserved. Refinements add early poster discovery, a valid concept-only crawler policy, a local favicon, and WebKit anchor/keyboard/focus-restoration fixes. Keep the image preload in `index.html` aligned with `siteConfig.hero.posterPath` when replacing the poster.

```bash
# Production preview (after npm run build):
npm run preview -- --host 127.0.0.1 --port 4173
# In another terminal, with Playwright CLI and the selected browser available:
playwright-cli -s=aether-qa open http://127.0.0.1:4173/ --browser=chrome
playwright-cli -s=aether-qa run-code --filename=tests/qa-browser.js
playwright-cli -s=aether-qa run-code --filename=tests/qa-keyboard-browser.js
playwright-cli -s=aether-qa close
```

Repeat the compatibility suite in separate `--browser=firefox` and `--browser=webkit` sessions when those test binaries are available. Run each older dev suite in a fresh browser session to isolate focus, media preferences and request mocks. Lighthouse was invoked temporarily through `npx`, without changing project dependencies; exact results and methodology are in the QA report.

The website is suitable for a client concept demonstration within the verified scope. It remains a noindex prototype with a local-only form; commercial publication, actual Safari/screen-reader/zoom testing and source-media rights clearance remain separate work.

## Client demonstration (Batch 7)

See [docs/DEMO_HANDOFF.md](docs/DEMO_HANDOFF.md) for the local preview commands, recommended client walkthrough, screenshots/recording, all ten cold/warm Lighthouse results, and publication requirements. No application behavior or media was changed in this batch.
