# Scroll-controlled frame blending

## Scope

This follow-up preserves the 72 desktop / 60 mobile WebP profiles, source video, asset pipeline, cache budgets (12 / 6), concurrency (2), 500svh section, and all four text-stage timings. No commit, push, or deployment is part of this work.

## Implementation

`frame-blend.ts` computes the fractional source position from the same normalized progress used by the story. Floor/ceiling indices identify an adjacent pair. `availableBlend` produces either an opaque single-frame plan, an adjacent two-frame plan, or no new plan while the previously painted surface remains visible. The nearest-frame diagnostic and request priority still use rounding.

`canvas-renderer.ts` draws an opaque base image and, when needed, overlays the next image with fractional `globalAlpha`. Both images use identical aspect-preserving placement. Alpha resets to one in `finally`, including draw errors. There is no blur, interpolation of geometry, synthetic zoom, or extra canvas/cache.

`use-hero-sequence.ts` uses the existing event-coalesced requestAnimationFrame path. It repaints only when the actual image plan, blend alpha, size/DPR, or context readiness changes. No time-based progression, springs, extra scroll listener, or permanent rendering loop. Late image completion schedules a fresh evaluation of current progress; it cannot draw an old pair. When a pair becomes available after a stall, its correct scroll-selected composition can replace the fallback without a timed fade. Once the images/progress are unchanged, the pixels remain frozen.

The loader gives the nearest frame first priority and its adjacent companion second priority, within the existing three-image request window; directional speculative frames fill remaining places. Duplicate indices are removed. This replaces a speculative neighbor rather than expanding the window. The existing cache, last-painted pin, eviction, failure cooldown, cancellation, and cleanup remain in use. A missing pair member falls back to the available member; if both are absent, the prior surface remains until a valid member loads. The exact first/last positions resolve to a single endpoint image.

## Configuration and comparison

Settings live in `siteConfig.hero.blending`: per-resource-profile desktop/mobile enable flags, window start/end, and smoothstep/linear curve. `VITE_HERO_BLEND=off npm run build` disables blending; `VITE_HERO_BLEND=continuous npm run build` produces the full-interval linear comparison. The default candidate uses smoothstep over fraction 0.35–0.65. These are build-time choices, not public controls or a separate animation timeline.

The prior discrete production build is retained only in ignored `artifacts/hero-blending/discrete-dist/`. The continuous comparison and screenshots are also local audit artifacts. No derivative media is regenerated.

## Visual comparison

Compared matching scroll positions on desktop 1440×900 and mobile 375×812, at interval fractions .4, .5, and .6 around the entrance and living room. Continuous linear interpolation produced obvious doubled door jambs, horizontal canopy edges, glazing, and furniture for a broad part of each interval. At fraction .4, the narrow smoothstep curve has alpha about .074 versus .4 for continuous interpolation, retaining a much clearer dominant image. Its full blend lasts only 30% of the interval.

At exactly .5 both curves produce a 50/50 exposure. **Ghosting is still visible there**, especially on furniture and window mullions; stopping there freezes that composite. The narrower window reduces its scroll duration, not its worst-case appearance. At a 12-second full traversal, the blend window lasts approximately 51 ms desktop or 61 ms mobile at constant speed, versus the entire 169/203 ms frame interval for continuous interpolation. Faster scrolling can skip the blend window; it is not synthetic high-frame-rate video.

Selected curve: smoothstep `t*t*(3-2*t)` with `t=clamp((fraction-.35)/.30,0,1)`. It preserves a sharp single image for 70% of each interval and eases into/out of the short blend. No source asset or global image filter changed. Screenshots are in `artifacts/hero-blending/{off,narrow,continuous}-{1440,375}-{entrance,interior}-{0.4,0.5,0.6}.png`.

## Verification

The selected narrow smoothstep window is enabled on desktop and mobile. The measured mobile difference did not show a meaningful frame-cadence or frame-lag regression under the tested conditions. Either resource-profile flag can be set to `false` independently if physical-device review calls for it.


## Production comparison protocol

Chromium on this macOS host, production preview, desktop 1440×900 DPR 1 and mobile 375×812 DPR 2. Each fresh context starts cold, then reloads warm with the same HTTP cache. The scroll path is 12 seconds forward, six reverse, and four rapid distant seeks. Scripts instrument decode/draw submissions, bitmap lifetimes, requested-versus-dominant-painted lag, rAF cadence, and main-thread task duration. Throttling uses 1.6 Mbps download, 100 ms latency, and 4× CPU. Cold/warm runs are individual observations, not field metrics or statistical guarantees.

The final comparison runs execute sequentially without concurrent browser suites. Use `discrete.json`, `narrow-repeat.json`, and `continuous.json`; `narrow.json` is exploratory (its final warm segment briefly overlapped an aborted baseline invocation) and is excluded from the comparison. Timing noise remains possible. The original discrete build is preserved, rather than simulating it by hiding a new effect.

Canvas timings below are synchronous `drawImage` submissions, not GPU completion or full rendering cost. CDP main-thread task duration covers the measured scrolling interval and audit overhead, not just the renderer. It excludes GPU/decoder-worker work and is not INP. Pair-miss samples indicate an adjacent image unavailable at a sampled tick, not a failed HTTP request.

### Normal network

| Mode | Device/cache | Draw calls | p95 draw ms | Main-thread task ms | p95 rAF interval ms | p95 lag (frames) | Frame requests |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Discrete | Desktop / cold | 147 | 0.10 | 1117 | 17.1 | 0 | 140 |
| Discrete | Desktop / warm | 147 | 0.10 | 1141 | 17.4 | 0 | 140 |
| Discrete | Mobile / cold | 123 | 0.10 | 1090 | 17.6 | 0 | 123 |
| Discrete | Mobile / warm | 123 | 0.10 | 1217 | 17.5 | 0 | 123 |
| Narrow | Desktop / cold | 793 | 0.10 | 1251 | 17.5 | 0 | 139 |
| Narrow | Desktop / warm | 799 | 0.10 | 1323 | 17.4 | 0 | 139 |
| Narrow | Mobile / cold | 771 | 0.10 | 1302 | 17.5 | 0 | 123 |
| Narrow | Mobile / warm | 750 | 0.10 | 1452 | 17.5 | 0 | 123 |
| Continuous | Desktop / cold | 2165 | 0.10 | 1190 | 16.9 | 0 | 139 |
| Continuous | Desktop / warm | 2165 | 0.10 | 1220 | 17.2 | 0 | 139 |
| Continuous | Mobile / cold | 2165 | 0.10 | 1361 | 16.9 | 0 | 123 |
| Continuous | Mobile / warm | 2165 | 0.10 | 1400 | 17.0 | 0 | 123 |

Normal cold frame-body transfer was identical in all three modes: 2,770,034 bytes desktop and 1,627,620 bytes mobile; normal warm transfer was zero. Peak tracked bitmap memory was unchanged at 26,956,800 bytes desktop and 8,164,800 bytes mobile, including transient decoding. Retained cache limits remain 12/6, and concurrency remains two. No extra asset profile or full-frame cache was added.

Narrow blending produced roughly 437–473 Canvas compositions versus 123–147 discrete compositions during this path, while continuous interpolation produced 1,085. Narrow draw calls were 750–799 versus 2,165 continuous. Main-thread task time rose about 0.13–0.23 seconds relative to discrete across the roughly 20-second traversal; this is additional work, although p95 sampled cadence stayed near 17.4–17.5 ms and p95 lag stayed zero in the repeated run. All normal comparison runs reported zero blank samples after readiness. The narrow mobile warm run recorded two long tasks (maximum 79 ms); other normal comparison rows recorded none. This intermittent cost is retained in the results and requires a final confirmation run. One narrow mobile warm run had 11/1,083 adjacent-pair-miss samples, using single-frame fallback; others had zero. This is not a guarantee for physical mobile GPU/thermal behavior.

### Throttled network and CPU

| Mode | Device/cache | p95 draw ms | Main-thread task ms | p95 rAF interval ms | p95 lag frames | Pair unavailable samples | Frame requests |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Discrete | Desktop / cold | 0.30 | 1185 | 17.7 | 21 | Not instrumented | 140 |
| Discrete | Desktop / warm | 0.40 | 1222 | 17.7 | 8 | Not instrumented | 139 |
| Discrete | Mobile / cold | 0.50 | 1125 | 17.7 | 5 | Not instrumented | 123 |
| Discrete | Mobile / warm | 0.50 | 1209 | 17.6 | 0 | Not instrumented | 123 |
| Narrow | Desktop / cold | 0.10 | 1195 | 17.7 | 20 | 692/1083 | 138 |
| Narrow | Desktop / warm | 0.10 | 1322 | 17.7 | 10 | 277/1083 | 137 |
| Narrow | Mobile / cold | 0.10 | 1165 | 17.6 | 5 | 335/1083 | 123 |
| Narrow | Mobile / warm | 0.10 | 1166 | 17.4 | 0 | 9/1083 | 123 |

Mobile p95 lag stayed five frames cold and zero warm. Desktop cold improved by one frame (21→20), while warm worsened by two (8→10). These are individual-run observations, not a guaranteed improvement. Additional pair availability requirements do not eliminate slow-network holds; the fallback remains essential. No blank samples occurred after initial readiness. First-frame/poster behavior remains independent of blending, and cold loading still does not request the full sequence. Warm throttled cache contains only the assets completed during its cold traversal.

## Final-build confirmation

The following runs use the final build including both delayed-load guards. Comparison candidate runs above are retained for reproducibility; successful steady-state rendering is the same. These final runs were also sequential and isolated from browser suites.

| Mode | Device/cache | Draw calls | p95 draw ms | Main-thread task ms | p95 rAF interval ms | p95 lag frames | Long tasks | Pair miss samples |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Normal | Desktop / cold | 795 | 0.10 | 1062 | 17.3 | 0 | 0 | 0/1083 |
| Normal | Desktop / warm | 793 | 0.10 | 1065 | 17.3 | 0 | 0 | 0/1083 |
| Normal | Mobile / cold | 771 | 0.10 | 1158 | 17.3 | 0 | 0 | 0/1083 |
| Normal | Mobile / warm | 769 | 0.10 | 1215 | 17.3 | 0 | 0 | 0/1082 |
| Throttled | Desktop / cold | 324 | 0.10 | 1134 | 17.7 | 21 | 3 | 701/1083 |
| Throttled | Desktop / warm | 608 | 0.10 | 1177 | 17.7 | 9 | 0 | 285/1083 |
| Throttled | Mobile / cold | 555 | 0.10 | 1018 | 17.7 | 5 | 3 | 339/1083 |
| Throttled | Mobile / warm | 767 | 0.00 | 1059 | 17.6 | 0 | 0 | 12/1082 |

The final normal runs have zero sampled frame lag, zero pair-miss samples, and no long tasks on both devices/cache states. The earlier two 79 ms mobile warm long tasks did not recur; they remain disclosed rather than erased. Absolute main-thread times varied across runs (including final values below the discrete baseline on desktop), so the evidence does **not** support a precise universal CPU-overhead percentage. Extra Canvas draw work is certain; measured sampled cadence and mobile lag remained comparable. Blending stays enabled on mobile within this tested scope, with an independent flag available for physical-device tuning.

Final throttled p95 lag is 21 desktop cold / nine warm versus baseline 21/eight, and five mobile cold / zero warm versus baseline five/zero. There is no evidence that blending fixes network stalls, and desktop warm has a one-frame p95 regression in this confirmation. Normal cold transferred exactly the same sequence bodies as baseline; warm sequence transfer was zero. Tracked decoded-memory peaks remain 25.7 MiB desktop / 7.8 MiB mobile. Every final row recorded zero blank samples after first readiness. These are local synthetic results, not a deployment or field-performance guarantee.

## Final verification and files

- TypeScript, lint, production build, and **12/12 unit tests pass**, including fractional mapping, reversal, exact endpoints, availability fallback, identical placement, and alpha restoration even if overlay drawing throws.
- Chromium production: **15/16 browser suites pass**, including the two-minute soak and all hero/story/accessibility/cache/throttled checks. The website interaction suite completes its interaction assertions but fails its strict console check on an unused Cormorant font-preload warning. This warning reproduced on the archived unchanged discrete production build. The same website suite **passes on its original development-server target**. No assertion or warning filter was removed; font loading is unchanged because it is outside this renderer refinement.
- After the two delayed-load corrections, final Chromium rechecks pass `hero-blending`, `hero-resilience`, `hero-browser`, and `hero-accessibility`. The production website warning remains reproducible and is an outstanding diagnostic, not a blending regression.
- Firefox and Playwright WebKit each pass QA, profile, and blend-specific suites; the enhanced blend suite passes again on both after the delayed-load corrections. This is engine coverage, not a manual Safari/physical-phone test.
- Browser blend tests prove pixel-identical reverse revisits, zero idle repaint/pixel drift, correct endpoints, rapid seeks, alpha reset, adjacent-only fallback, holding when both images fail, fresh mid-hero fallback, and delayed-opening-frame protection.
- A verified mid-hero failure race was fixed: exhausted nearest-frame retries must not collapse to static mode while a valid companion is still pending. The endpoint refinement prevents a fast second image from replacing a delayed first image at progress zero. These guards do not change the successful steady-state blending curve.
- All **136 hero files** (132 frames, three manifests, poster) match the prior discrete build and final `dist/` byte-for-byte. The original MP4 checksum is unchanged. No dependencies or frame-generation changes.
- Final production JS is **121.62 kB gzip**, versus **120.99 kB** before (+0.63 kB). CSS remains **6.49 kB gzip**. Git whitespace validation passes.

Results are saved as `artifacts/hero-optimization/blending-{chromium,firefox,webkit}.json`, `blending-final-*.json`, `blending-baseline-website.json`, and `blending-dev-website.json`. The baseline/font-warning evidence is retained transparently.

Runtime files changed in this follow-up:

- `src/components/hero/frame-blend.ts` — pure fractional mapping and availability selection (new).
- `src/components/hero/canvas-renderer.ts` — optional adjacent overlay and alpha cleanup.
- `src/components/hero/frame-loader.ts` — companion priority within existing request/cache budgets.
- `src/components/hero/use-hero-sequence.ts` — resolve and deduplicate blend plans through existing scheduling.
- `src/config/site.ts` — configurable window/curve and per-resource-profile flags.

Tests/tooling: new `tests/hero-blend.test.mjs`, `tests/hero-blending.js`, and `scripts/compare-hero-blending.mjs`; extended `scripts/benchmark-hero.mjs` with cadence, pair availability, output-directory and main-thread task measurements; `scripts/run-browser-suites.mjs` can redirect older development URLs to production preview; `tests/hero-resilience.js` now checks exact adjacent fallback and rejects any asynchronously drawn image outside the current pair. Its missing-frame assertion changed because the requested behavior now permits a valid adjacent image rather than requiring the old distant held image; a new test separately verifies holding when **both** adjacent images fail. No coverage was removed. Additional delayed-load coverage verifies that a fast second image cannot replace the opening composition, and that a failed nearest image on a fresh mid-hero arrival does not discard a still-pending valid companion. The implementation now waits for both pair members to exhaust their retries before switching to static mode when no image has yet painted; exact endpoints only accept their endpoint image.

Documentation: this report, README link/configuration notes, and a narrowly scoped MOTION_REFERENCE.md addition recording the user-authorized fractional rendering refinement. Story timings, visual design, product requirements, manifests, media, package dependencies, and frame-generation script were not changed in this follow-up.

## Reproduction and review evidence

1. `npm run build` then `npm run preview -- --host 127.0.0.1 --port 4173` starts the selected implementation.
2. `HERO_OUTPUT=artifacts/hero-blending HERO_LABEL=review node scripts/benchmark-hero.mjs` repeats the normal comparison protocol; add `HERO_THROTTLE=1` for the constrained mode. Use unique labels to preserve recorded evidence.
3. `SUITE_URL=http://127.0.0.1:4173/ SUITE_REPORT=blending-review node scripts/run-browser-suites.mjs hero-blending hero-resilience` exercises blend-specific behavior. Existing installed Firefox/WebKit can be selected with `BROWSER=firefox` or `BROWSER=webkit`.
4. `VITE_HERO_BLEND=off npm run build` disables blending; `VITE_HERO_BLEND=continuous npm run build` builds the continuous linear comparison. Run ordinary `npm run build` afterward to restore the selected default. No runtime query parameter changes user experience.

[Desktop narrow entrance](../artifacts/hero-blending/narrow-1440-entrance-0.4.png) · [same position, continuous](../artifacts/hero-blending/continuous-1440-entrance-0.4.png) · [desktop 50/50 interior limitation](../artifacts/hero-blending/narrow-1440-interior-0.5.png) · [mobile narrow entrance](../artifacts/hero-blending/narrow-375-entrance-0.4.png) · [mobile midpoint](../artifacts/hero-blending/narrow-375-interior-0.5.png) · [same mobile position, discrete](../artifacts/hero-blending/off-375-interior-0.5.png).

All 36 screenshots and individual JSON measurements are under ignored `artifacts/hero-blending/`. `visuals.json` records exact indices/alphas. The local comparison script expects discrete/continuous previews on ports 4180/4181 and the selected preview on 4173. These audit builds/assets are not deployable public files.

Limitations: midpoint double exposure remains inherent in this two-image method; narrow interpolation reduces its duration. Fast scrolling may skip fractional transitions. Cache misses can resolve from a held/single image directly to the current composite when images arrive. Actual mobile hardware, manual Safari, GPU traces, screen-reader walkthroughs, and production CDN delivery were not assessed by this local change. No field performance, perfect smoothness, or universal compatibility claim is made. No commit, push, or deployment has occurred; review is required before publication work.
