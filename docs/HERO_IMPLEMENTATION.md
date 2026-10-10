# Batch 3 — Cinematic hero implementation

## Scope and specification ownership

The scroll-controlled hero is implemented in the existing Vite/React application. The four text stages, property listings, forms, and final navigation remain unimplemented. Static identity text and a clearly marked development section provide a way to verify the hero and its release. The main specifications were not changed.

The desktop cover-fit request is reconciled with the source-framing requirements through bounded use of cover: desktop viewports between 1.45:1 and 2:1 use proportional cover, anchored to the bottom/right to preserve the source watermark. Portrait, tablet, and extreme-wide viewports use the full source image with cinema-colored negative space. Contained imagery sits slightly above center to leave breathing room for the static introduction. The same placement applies to poster and canvas.

## Architecture and files

- `src/components/hero/ScrollHero.tsx`: semantic composition, independent HTML overlays, poster, canvas, static identity, and skip link.
- `src/components/hero/use-hero-sequence.ts`: manifest fetch, observers, event-driven requestAnimationFrame scheduling, target selection, rendering lifecycle, and cleanup.
- `src/components/hero/frame-loader.ts`: prioritized bounded fetch/decode pool, one retry, timeout, cache eviction, cancellation, and bitmap release.
- `src/components/hero/canvas-renderer.ts`: aspect-preserving placement, backing-store sizing, DPR cap, and valid-image-only drawing.
- `src/components/hero/manifest.ts`: validated runtime metadata, base-aware public URLs, and pure scroll/frame calculations.
- `src/components/hero/use-hero-mode.ts`: reduced-motion/Save-Data handling and reading-position preservation on live preference changes.
- `src/pages/HomePage.tsx`: hero plus temporary release-verification section.
- `src/config/site.ts`: configurable identity, heading, manifest, and poster paths.
- `src/styles/hero.css`, `fonts.css`, and `globals.css`: responsive cinematic composition, focus states, local fonts, and global foundation.
- `public/fonts/`: Cormorant Garamond and Manrope Latin WOFF2 assets and OFL licenses, obtained from Google Fonts. No runtime font service is required.
- `index.html`: font preload and favicon request handling.
- `tests/hero-math.test.mjs`: pure mapping, manifest, URL, and aspect-ratio tests using Node's built-in test runner.
- `tests/hero-browser.js`, `hero-resilience.js`, `hero-accessibility.js`, `hero-touch.js`: repeatable Playwright CLI regression checks.
- `package.json`: added `npm test`; no dependencies added or reinstalled.
- `README.md`, `.gitignore`, and this document: runtime/test handoff and local-artifact exclusions.

## Scroll and rendering

The outer section is 500svh and the pinned child is 100svh. Native browser scrolling supplies position; there is no wheel/touch interception, autoplay, timer-based camera movement, or spring lag.

On relevant scroll/resize/load events, one requestAnimationFrame callback measures the section and sticky viewport. Progress is clamped from `-sectionTop / (sectionHeight - viewportHeight)`; the target is `round(progress × (manifest.frameCount - 1))`. Zero/invalid distance is guarded. Index 0 maps to the manifest's first numbered image. The same progress produces the same target in both directions.

A Motion value exposes progress for later overlay work without React state updates on every frame. Canvas attributes distinguish the wanted frame from the actually painted frame. Async completion only schedules the current target; outdated results cannot repaint an old target. Drawing is synchronous within a browser frame. On resize, a cache miss reuses the last valid image; the poster stays underneath until a successful draw. DPR is capped at 2. IntersectionObserver and document visibility suspend work when the hero is distant or hidden; there is no continuously running rendering loop.

## Loading and memory

The target frame leads a small directional neighbor window. Desktop uses four request/decode slots, five frames ahead and two behind; mobile/coarse-pointer devices use two slots, two ahead and one behind. Aborted decodes occupy their slot until settled, avoiding hidden decode-concurrency growth.

The configurable frame ceiling is 28, additionally limited by a decoded-image budget of 64 MiB desktop and 24 MiB mobile. For the actual 1280 × 720 source, those budgets permit **18 desktop / 6 mobile cached frames**. This deliberately uses fewer than the nominal ceiling because 28 native-resolution decoded images would consume about 98 MiB before the canvas and other resources. Cache budgets are updated on resize/input-profile checks. The current target and last painted image are protected from eviction.

Unneeded in-flight requests are aborted, duplicate pending requests are prevented, and obsolete results are closed. Eviction and teardown explicitly release ImageBitmaps; an HTMLImageElement decoding fallback revokes object URLs. A failed frame gets one retry, then retains the current visual. Manifest or initial-sequence failure falls back to the short static hero. Requests time out after 12 seconds. HTML text and links never wait for this work.

## Accessibility and alternatives

The canvas and poster are decorative; the page has one semantic h1 and an equivalent screen-reader description of the architectural journey. All static identity text remains available before frames load. The skip link bypasses the complete scroll region and focuses the following section. Keyboard/touch scrolling stays native.

Reduced motion, reduced data where supported, and Save-Data show the static poster without fetching a manifest or frame sequence. Live preference changes dispose the renderer and preserve the logical reading position. Missing poster/media leaves readable content and usable navigation on the cinema backing surface. Locally hosted fonts use `font-display: swap`. Text scrims are localized away from the lower-right watermark.

## Executed verification

Tests ran in Chromium through the installed Playwright CLI, against the actual local Vite app. Browser test results are saved locally in `artifacts/browser-*-results.txt`.

| Check | Observed result |
| --- | --- |
| Fresh/cold load | Poster and HTML visible before the first decoded frame; first canvas paint is frame 1 |
| Forward/reverse | At 0/25/50/75/100%: 1/61/121/180/240; reverse visits match |
| Idle | Painted frame and render count stay unchanged while stationary |
| Rapid seeking with delayed images | Seeks to 50%, 90%, then 10% settle on frame 25; no stale target paint observed |
| Sticky release | At 450 px beyond active travel, stage top is -450 px and following content enters the viewport |
| Desktop/tablet/mobile | 1440 × 900, 768 × 1024, 375 × 812; valid start/middle/end frames, no horizontal overflow |
| Resize/orientation | 375 × 812 → 812 × 375 → 1440 × 900: valid canvas, correct target, no overflow; cache shrinks for mobile |
| Touch emulation | iPhone 13 profile; actual viewport 390 × 664, DPR 3, canvas DPR capped at 2; swipe advances and skip/back links work |
| Memory/concurrency | Desktop cache 18, observed transient bitmap peak 19, request slots at most 4; all tracked bitmaps released on motion disable |
| Reduced motion | Short poster hero; zero manifest/frame requests; live switching returns to a coherent hero reading position |
| Save-Data | Static mode with zero manifest/frame requests |
| Missing frame | Last painted frame held; exactly two requests (initial plus one retry); later seeking recovers |
| Bad manifest / corrupt JPEGs | Readable static fallback, usable continuation |
| Total media failure | Heading and continuation remain usable even with no poster or sequence |
| Keyboard/focus | Tab reaches visible skip link; Enter moves focus to the post-hero section; back link works |
| Compact layout | 320 × 568, 720 × 450 (zoom-equivalent CSS viewport), 1440 × 720: text/skip fit, no overflow |
| Distant hero | No continuing paints while far outside the viewport |
| Runtime errors | No uncaught page errors during the tested flows; intentionally mocked HTTP failures produce expected network diagnostics |
| Local layout shift sample | Approximately 0.00005 in the instrumented Chromium run; not a Lighthouse or field performance score |
| Unit checks | Three Node test cases passed |
| TypeScript / lint / production build | Passed; lint has no warnings |
| Production preview | First/final frames and both local fonts load successfully; no failed requests or page errors |

Local screenshots include `hero-desktop.png`, `hero-desktop-middle.png`, `hero-desktop-final.png`, `hero-768.png`, `hero-375.png`, `hero-reduced-motion.png`, `hero-slow-load.png`, and `hero-touch-dpr3.png` in `artifacts/`. They were inspected for framing, readability, and visible source watermark. No tearing or blank frame was observed in these checks; this is not an exhaustive device/GPU guarantee.

## Limits and next batch

- Tests used Chromium and emulated touch/viewport conditions, not physical iPhones, Safari/WebKit, or every browser toolbar behavior. Screen-reader behavior received a semantic/focus review, not an assistive-technology session. The compact 720 × 450 check is a zoom-equivalent viewport, not an actual browser-zoom test.
- Decoded-image limits exclude the current canvas backing store, browser HTTP cache, and transient in-flight decoding. Native 720p JPEGs still total approximately 22 MiB across a full traversal. Cold/slow connections can temporarily hold the last frame. No mobile asset variant was generated.
- No Lighthouse, field Core Web Vitals, or sustained low-end-device frame-rate benchmark is claimed.
- The source watermark remains visible. No video/frame regeneration, architectural modifications, or watermark concealment occurred.
- Ready for Batch 4's overlay work: use the existing progress Motion value and overlay layer. Do not replace the deterministic frame mapping with a spring. Batch 4 remains subject to explicit approval.
