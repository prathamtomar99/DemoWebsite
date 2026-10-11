# Cinematic preparation and compressed cache warm-up

> Historical three-frame strategy. The explicitly requested replacement is documented in [FULL_FRAME_PRELOADER.md](FULL_FRAME_PRELOADER.md).

## Scope and implementation

The existing 72-frame desktop / 60-frame mobile WebPs, 35–65% smoothstep blending, decoded cache ceilings (12 / 6), two decoding slots, rendering pipeline, four story ranges, and website interactions are preserved. No asset regeneration, dependencies, service worker, persistent application cache, commit, push, or deployment.

The actual starting scroll-height token was **350svh**. It remains unchanged. `MOTION_REFERENCE.md` previously said 400svh, and the core browser test still asserted four viewports. Both now describe/check the existing 3.5-viewport section; this task does not change scroll speed.

- `HeroPreparation.tsx` provides the warm neutral screen, configured brand, supporting status, and thin native progress indicator. Its progress measures **decoded startup frames out of three**, not estimated bytes, elapsed time, or the whole sequence. No fake percentage or minimum waiting period.
- `use-hero-preparation.ts` ends preparation after a valid Canvas draw and the small decoded startup window, or after 2.5 seconds from the preparation effect starting. The poster loads immediately beneath the screen and remains the fallback. Timeout reveals the page while ordinary demand loading can still recover; it does not collapse the pinned region merely because the network is slow.
- Interaction, focus, hash navigation, existing scroll progress, or page departure dismisses preparation. Deep links, already-scrolled entries, reload/back-forward navigation, reduced motion, and Save-Data bypass it. There is no scroll lock, input interception, focus trap, or extra scroll listener. Focused content cannot remain covered. The overlay exits in 160 ms and never appears again during the same mount.
- `HeroStory.tsx` keeps the existing mounted DOM and outer scroll timeline. Only its nested introductory entrance waits for reveal; subsequent stages remain deterministic. Static modes show the opening identity immediately.
- `frame-transport.ts` is shared by the existing decoded loader and the warmer. It permits two total fetch slots and at most one background fetch. Visible requests join an identical in-flight fetch or preempt unrelated speculation. Nearest-frame requests retain high priority, neighbors low priority. Completed response bodies populate the browser HTTP cache; only active requests retain transient Blobs. Completed-index bookkeeping contains numbers, not images or response bodies.
- Warming starts after startup readiness and document load, on a suitable connection, while the hero is near and the document active. It pauses while frame targets are changing, resumes after 200 ms of target stability, and orders remaining files from the latest target in the direction of travel. No permanent animation loop. Save-Data, reduced motion, reported 2G/3G, downlink below 2 Mbps, or RTT above 150 ms prevent full-sequence warming. Missing connection information is handled conservatively with one speculative slot and visible-request precedence; it cannot prove a fast physical connection.
- Background failures are not retried indefinitely. Visible-frame retries retain the existing loader's bounded policy. Timers, listeners, pending requests, and bitmaps are cleaned up on departure/unmount/static-mode changes. Offscreen/hidden work suspends through the existing lifecycle observers.

`siteConfig.hero.preparation` enables the feature; `VITE_HERO_PREPARATION=off npm run build` disables both the screen and background warming for comparison. Profile selection remains latched for the page view. The warmer never requests another viewport profile or property photographs.

## Cache behavior on the deployed site

A live browser probe on 11 October 2026 read the actual versioned first frame URL from the deployed manifest. Vercel returned `Cache-Control: public, max-age=0, must-revalidate`, an ETag, and `x-vercel-cache: HIT`. A CDN HIT alone does not prove reuse by the browser.

The probe consumed a `fetch(..., {cache:'force-cache'})` response body, then repeated that fetch and decoded it through the same Blob/ImageBitmap path used by the hero:

| Engine | First transfer | Repeat transfer | Repeat duration |
| --- | ---: | ---: | ---: |
| Chromium | 76,842 bytes | 0 | 0.5 ms |
| Firefox | 76,842 bytes | 0 | 1 ms |
| Playwright WebKit | 76,905 bytes | 76,905 bytes | 32 ms |

Thus reuse is demonstrated in Chromium/Firefox but **not** in WebKit under the current deployed headers. The transport stops further speculation if resource timing shows a repeated foreground transfer for an already downloaded file; demand loading continues normally. This is an adaptive fallback, not a guarantee of HTTP-cache residency: eviction, disabled caches, response policies, and engine behavior can force refetching. Some speculative downloads can occur before non-reuse is observed. `data-compressed-ready` counts successfully downloaded unique files, not independently verified cache residents.

No Vercel configuration was changed or deployed. A future approved hosting change can give fingerprinted frame URLs an appropriate freshness lifetime, followed by another WebKit reuse check. Avoid applying immutable caching indiscriminately to unversioned manifests or replaceable assets.

## Measurement protocol and limitations

Local production builds are compared against an archived unchanged build in `artifacts/cinematic-preloader/before-dist`. Installed Chrome is automated through Playwright on this Mac; desktop 1440×900 and mobile 375×812. These are synthetic viewport/network tests, not physical phones, field INP, or manual Safari.

- `benchmark-hero.mjs`: existing 12-second forward / six-second reverse / distant-jump traversal, cold then warm HTTP cache. The host's default Network Information API reported 1.5 Mbps, so the warmer correctly remained disabled in these runs.
- `measure-preparation.mjs`: explicitly consistent network information and CDP settings. Suitable link: 10 Mbps, 80 ms latency, 4× CPU slowdown. Constrained link: 1.6 Mbps, 100 ms latency, 4× CPU, reported 3G (no speculation). Fixed nine-second reading interval from navigation, six seconds forward, three reverse, then distant jumps. This is a demanding traversal: a constrained link cannot deliver the full desktop sequence at that speed.
- `measure-preparation-seeks.mjs`: same suitable link, fixed 12-second reading interval, then seven identical distant seeks in both directions. Cold and warm contexts distinguish compressed-cache benefits from the decoded cache. Readiness latency includes waiting until the exact requested dominant frame appears.
- Resource Timing/CDP record fetch calls, cache hits, and transfers. Calls that are HTTP-cache hits do not represent additional asset downloads. Initial prefetch deliberately downloads more than the old three-file startup window; visitors who leave without exploring may use more bandwidth.
- Decoded memory counts live RGBA ImageBitmaps, including transient decodes, excluding Canvas backing stores, GPU allocations, HTTP cache, property images, and browser internals. Canvas submission timing is not full GPU work.
- LCP is recorded **before scripted scrolling**. Programmatic scrolling does not terminate LCP collection like actual user input and can otherwise make the later finale misleadingly appear as a 14-second LCP. No Lighthouse or field-performance claim is inferred from these measurements.

Individual measurements, screenshots, and regression reports remain under ignored `artifacts/`; only scripts/tests and this report are source files. Results are single controlled observations, not statistical guarantees. The initial exploratory run led to pausing speculation during active scrolling to avoid unnecessary cancellations; final seek/regression checks use that correction.

## Verification results

### Useful improvement and its cost

In the final distant-seek comparison, all compressed files had downloaded by the identical 12-second reading mark. Only **three** images were decoded/resident before scrolling in both builds. Each cell below summarizes seven seeks; all reached the exact target without a blank Canvas.

| Device / cache | Before median seek | After median seek | After reveal from navigation | Downloaded files at 12 s |
| --- | ---: | ---: | ---: | ---: |
| Desktop / cold | 164.7 ms | 33.4 ms | 1,018 ms | 72 |
| Desktop / warm | 33.1 ms | 33.1 ms | 381 ms | 72 |
| Mobile / cold | 150.3 ms | 32.9 ms | 927 ms | 60 |
| Mobile / warm | 33.0 ms | 33.5 ms | 365 ms | 60 |

This supports retaining the feature for **cold-cache navigation after a reading interval**. It does not prove faster initial page loading or faster already-warm seeks. A visitor who scrolls immediately has less preparation time and can still encounter misses. First useful architecture is covered by the preparation screen until reveal; fast poster download alone is not a visible-hero improvement.

For this partial-tour seek workload, cold transferred frame bytes including Resource Timing overhead increased from **813,692 to 2,791,634** desktop and **569,750 to 1,645,620** mobile because the new warmer intentionally downloads the whole active sequence. Completed fetch calls increased from 20 to 89 desktop and 20 to 77 mobile; the new cold runs included 17 cache hits each, and the warm runs had 89/89 and 77/77 cache hits with **zero frame transfer**. This is a bandwidth-for-readiness tradeoff, not a request-count reduction. No concurrently duplicated fetch was observed in the focused queue/browser tests; HTTP-cache reads after bitmap eviction remain necessary.

The controlled nine-second-reading traversal found desktop cold p95 lag improved from one frame to zero on the suitable link; mobile was already zero. Constrained-link speculation is deliberately disabled: desktop p95 lag stayed 65/71 frames in the aggressive six-second traversal, and mobile cold stayed 23/59. Mobile warm p95 changed from 18 to 19 frames in single observations, a recorded regression/noise limit, not an improvement claim. Preserve the last painted image during these stalls. The ordinary existing throttled suite, which waits for each requested target, passed all three forward/reverse cycles.

Measured transient peak decoded memory remained **26,956,800 bytes desktop / 8,164,800 bytes mobile** (13/7 images including transient work), with retained ceilings 12/6. The normal-network benchmark recorded p95 Canvas draw submission of 0.1 ms and zero sampled frame lag both before and after. The nine-second-reading cold exploratory run observed two main-thread long tasks on desktop after preparation versus zero before; no long tasks in either warm desktop run. These single observations do not establish causality or field responsiveness.

Pre-scroll LCP in the final seek comparison was desktop cold **604→528 ms**, desktop warm **264→268 ms**, mobile cold **512→520 ms**, and mobile warm **264→260 ms**. The loading screen changes the visible candidate, so these numbers **must not be presented as an improvement in time to architecture**. Use measured reveal time alongside them. There is no Lighthouse/INP claim.

### Final traversal recheck after the cancellation fix

A final suitable-network run used the corrected pause-during-scroll queue. All four runs recorded zero p95 frame lag, zero failed frame requests, and unchanged memory peaks. At the nine-second reading point desktop cold had downloaded 57 files, desktop warm 72, and mobile 60; only three were decoded. The visible pause is not extended to finish the queue.

| Device / cache | Frame fetch calls | Frame body bytes transferred | First Canvas | Preparation-ready time | Decode p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop / cold | 194 | 2,770,034 | 1,101 ms | 1,255 ms | 10.2 ms |
| Desktop / warm | 208 | 0 | 449 ms | 471 ms | 10.8 ms |
| Mobile / cold | 179 | 1,627,620 | 971 ms | 1,128 ms | 6.8 ms |
| Mobile / warm | 179 | 0 | 449 ms | 470 ms | 6.6 ms |

The prior suitable-network baseline was 139 desktop / 122 mobile fetch calls, with the same complete cold sequence body bytes and zero warm body transfer. Additional calls are cache reads as decoded images are evicted; the final queue has no cancelled background requests during these traversals. The exploratory desktop run had 249 calls, motivating the pause correction.

**Recorded regressions:** this final cold recheck observed three main-thread long tasks per device (maximum 128 ms desktop / 89 ms mobile under 4× CPU slowdown), versus zero desktop / one mobile in the original baseline. Warm runs had none. Pre-scroll LCP was 716/340 ms desktop cold/warm and 656/336 ms mobile, higher than the baseline's 516/264 and 524/260 ms. First Canvas also arrived later in these runs. These are individual synthetic observations and differ from the earlier seek-run LCP values; neither set is suppressed. The feature is retained for the demonstrated cold distant-seek improvement, while explicitly accepting a roughly one-second cold reveal and extra speculative bandwidth, **not** on a claim of universally better startup/main-thread metrics. Further physical-device and deployed-cache testing remains warranted.

Final data: `controlled-final.json`; exploratory before/after traversal and constrained-link data: `controlled.json`; final seek comparison: `seeks.json`; live cache probe: `live-cache.json`, all in `artifacts/cinematic-preloader/`.

### Functional and visual checks

- TypeScript and production build passed. Lint: zero warnings. **16/16 unit tests passed**, covering existing mapping/blending/timelines/forms plus constrained-network policy, shared-request promotion, concurrency, cancellation/disposal, failure policy, and cache-nonreuse fallback. Node emits its experimental `stripTypeScriptTypes` notice for the transport unit-test adapter; it is not a runtime-site warning.
- Final Chromium: **16/17 suites passed**. All hero, story, accessibility, profile, throttled, blending, preparation, 122-second soak, QA/keyboard, and demo suites passed. `website-browser` completed its interaction assertions but failed its strict console check on the **previously documented Cormorant font-preload warning**. The font configuration and assertion are unchanged; this failure is not hidden or filtered.
- Firefox: **3/3 suites passed** (preparation, profiles, blending). Playwright WebKit: **3/3 passed** for the same suites. WebKit coverage is not manual Safari testing.
- Preparation tests verify real progress, entrance held until reveal, no full-sequence decoding, one profile only, zero simultaneous duplicate requests, max two active fetches, pagehide suspension/pageshow recovery, reload bypass, 3.5-second manifest delay with timeout release, failed frames/static fallback, deep links, reduced motion, and Save-Data. The mocked delay tests revealed after three decoded frames in 0.54–1.13 seconds. Timeout release was observed at 2.56–2.64 seconds **from navigation**, consistent with a 2.5-second deadline after mount.
- Startup warmup finished with three decoded/resident images on every tested engine and viewport. Save-Data and reduced-motion made zero sequence requests. Full warmup tests include a cancelled background request during pagehide in some runs, then a later retry; that is not a duplicate concurrent fetch.
- Existing regressions preserve all four stages, forward/reverse/jumps, frozen idle state, endpoint images, sticky release, resize/orientation, poster fallback, hidden CTA exclusion, focus restoration, navigation, property dialogs, and local-only viewing validation.
- Inspected desktop and mobile preparation/reveal screenshots. Warm neutrals and the existing display face remain consistent; no new image treatment, clipping, or distortion. The source watermark remains unchanged. Existing suites also cover tablet, 320 px, and compact landscape layouts.

Screenshots: [desktop preparation](../artifacts/cinematic-preloader/preparing-1440.png), [mobile preparation](../artifacts/cinematic-preloader/preparing-375.png), [desktop reveal](../artifacts/cinematic-preloader/revealed-1440.png), [mobile reveal](../artifacts/cinematic-preloader/revealed-375.png). Regression reports: `artifacts/hero-optimization/preparation-final-{chromium,firefox,webkit}.json`.

### Bundle, files, and remaining limitations

Production JavaScript: **121.62→124.74 kB gzip** (+3.12 kB). CSS: **6.50→6.69 kB gzip** (+0.19 kB). No package/dependency changes. WebP files and frame counts are unchanged.

Added runtime files: `HeroPreparation.tsx`, `use-hero-preparation.ts`, and `frame-transport.ts` in `src/components/hero/`. Modified: `ScrollHero.tsx`, `HeroStory.tsx`, `frame-loader.ts`, `use-hero-sequence.ts`, `src/config/site.ts`, and `src/styles/hero.css`. Added focused transport/preparation tests and the three measurement/probe scripts. Existing story tests now expect the authorized preparation deadline; geometry assertions reflect the already-existing 350svh token. `MOTION_REFERENCE.md` records the explicit loading-rule override and corrects stale height prose; product/design specifications remain untouched.

Ready for local review. Remaining limitations: the pre-existing production font warning, current Vercel/WebKit cache behavior, possible extra bandwidth for visitors who leave early, unavoidable cold constrained-network stalls, and lack of physical-device/manual Safari or actual screen-reader testing. The fallback relies on available Resource Timing evidence and cannot guarantee detection of every cache miss. No commercial media-rights claim is added; the existing watermark/licensing restrictions remain. Nothing has been committed, pushed, or deployed.
