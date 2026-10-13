# Full-frame cinematic preparation

## Decision and scope

The normal cinematic path now waits for **all 72 desktop frames or all 60 mobile frames to download, decode, and remain retained**, followed by the first successful Canvas draw. It no longer reveals after three decoded images, dismisses merely because the visitor scrolls, or relies on HTTP-cache reuse to decode images later.

The user explicitly authorized replacing the prior memory strategy. The 72/60 WebPs, source video/watermark, 350svh scroll-height token, 35–65% smoothstep blending, four story ranges, typography, listings, forms, navigation destinations, and SEO are unchanged. No dependencies, commits, pushes, or deployments.

## Memory policy, evaluated before downloading

| Profile | Decoded RGBA estimate | Configured ceiling |
| --- | ---: | ---: |
| Desktop: 72 × 960 × 540 × 4 | 149,299,200 bytes / 142.4 MiB | 160 MiB |
| Mobile: 60 × 720 × 405 × 4 | 69,984,000 bytes / 66.7 MiB | 80 MiB |

`full-frame-policy.ts` computes these from the validated manifest. `siteConfig.hero.decodedBudgetMiB` configures the ceilings. Reported `navigator.deviceMemory` ≤2 GB lowers the ceiling to 32 MiB; ≤4 GB caps it at 80 MiB. Thus a reported 2 GB device gets the poster, a reported 4 GB desktop gets the poster, and a 4 GB mobile profile can fit. Missing device-memory information uses the configured profile ceiling, not an invented hardware measurement. Mobile versus desktop is selected once from the viewport, as before.

This is a deliberate memory increase from 12/6 retained frames. Estimates exclude Canvas backing stores, GPU texture residency/copies, browser overhead, other page images, and transient compressed responses. The API describes approximate installed RAM, not current free memory. Emulated-mobile tests on this Mac do not establish physical-phone safety. A memory-budget rejection, missing ImageBitmap capability, allocation/decode failure, or preparation timeout falls back to the short poster hero rather than pretending a rolling decoded window is completely ready.

Decoded ImageBitmaps remain in the same loader cache through normal scrolling, including leaving/re-entering the sticky region. There is no second decoded cache or full-sequence Blob cache. On unmount or a switch to the static alternative, every bitmap is closed. They are not evicted merely on resizing; the selected asset profile and its validated retention ceiling stay latched. Browser/GPU memory pressure outside the application's observable APIs can still terminate a tab and cannot be guaranteed preventable by this estimate.

## Loading, rendering, and progress

- `FrameLoader.prepareAll()` now uses four independent download slots, bounded compressed buffering, and two decode slots, beginning with the first composition. Dimension validation, retries, disposal, and full retention remain. `FrameTransport` supplies deduplicated fetches without speculative warming on this path. See [FRAME_CONCURRENCY_PRODUCTION_INTEGRATION.md](FRAME_CONCURRENCY_PRODUCTION_INTEGRATION.md) for the integration; measurements below describe the earlier combined two-slot implementation.
- Each completed download contributes one progress unit and each successful decode another. The final Canvas draw contributes the last unit. The UI reports an integer percentage, plus actual downloaded/decoded counts. It never reports 100% before all requirements succeed. Download progress counts whole files, not byte estimates.
- `use-hero-sequence.ts` continues publishing the same scroll MotionValue. It defers Canvas presentation until every frame is retained; subsequent frame selection/blending uses the existing renderer and event-coalesced rAF. No network download or asynchronous decode is needed for an ordinary seek after successful preparation. ImageBitmaps are decoded; this does **not** mean every image was pre-uploaded to the GPU.
- `HeroPreparation.tsx` retains the warm identity and adds honest percentage/counts plus an accessible “Continue without the film” link. The screen fades over 160 ms after success. `HeroStory` keeps its existing entrance coordination and unchanged scroll windows. Underlying hero controls are inert while covered; the loading-screen bypass remains keyboard reachable.
- There is no artificial minimum delay. Warm HTTP-cache visits still decode all selected frames; a previous page's decoded objects are not persisted.
- Reload/history entry can prepare at the restored scroll position without forcing the page to the top. Initial lower-page anchors bypass preparation and sequence requests with the static hero. Normal anchor navigation **after successful preparation** preserves the retained film. A lower-page anchor used while loading cancels preparation and releases its resources.
- Reduced motion, reduced data/Save-Data retain the existing immediate static alternative with no sequence requests. A slow connection alone does not trigger partial reveal: it shows real progress until completion or failure/deadline.

## Failure handling and diagnostics

Each failed frame receives one retry through the existing loader. Any frame still unavailable after that retry invalidates full preparation and falls back to the poster. The old adjacent-frame fallback math remains unit tested, but missing files cannot appear mid-scroll on the successful fully retained path. Corrupt bytes or wrong dimensions also fail preparation.

`siteConfig.hero.preparationTimeoutMs` defaults to **45,000 ms** from preparation setup, including manifest loading. A local comparison build can set `VITE_HERO_PREPARATION_TIMEOUT_MS`; there is no production query-string override. Frame fetch/decode slots retain their 12-second timeout. Hidden/offscreen work suspends through existing lifecycle handlers; the safety deadline may choose the poster if the visitor leaves preparation inactive for too long.

Useful DOM diagnostics: `data-compressed-ready`, `data-decoded-ready`, `data-cache-size`, `data-cache-capacity`, `data-inflight`, `data-decoded-bytes`, `data-decoded-budget`, `data-preparation-ms`, and `data-preparation-failure` on the hero. Reasons include memory-budget, bitmap-unavailable, frame-failed-after-retry, manifest-unavailable, safety-timeout, and navigation-bypass. Development builds also emit a reason via `console.info`; no customer data is logged.

## Verification and measurements

### Protocol

An unchanged production build of the three-frame preloader is archived in ignored `artifacts/full-frame-preloader/before-dist` and served on port 4183; the new production preview uses port 4173. `scripts/benchmark-full-preloader.mjs` derives from the existing benchmark and adds preparation/download/decode diagnostics. Measurements run sequentially without other browser suites: Chromium on this Mac, 1440×900 desktop / 375×812 mobile, DPR 1/2. Each context runs cold HTTP cache, then a warm reload. Warm caches contain only what that build actually downloaded in its cold run.

Each traversal waits for initial readiness plus 1.6 seconds, then scrolls 12 seconds forward, six reverse, and makes four distant jumps. Throttled runs use 1.6 Mbps download, 100 ms latency, and 4× CPU slowdown. The prior preloader's background-warming policy sees the host's constrained connection estimate and uses its ordinary three-frame path. This compares the actual previous configuration, not a fabricated baseline.

The table reports reveal timestamps **from navigation**, including initial application delivery. The new screen's own preparation duration is also recorded separately below. These are individual local observations, not medians across repeated trials, Lighthouse, field INP, or universal device guarantees.

### Before/after results

| Link / device / cache | Previous reveal | Full reveal | Prepared at full reveal | p95 frame lag before → after | Post-startup decodes before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal / desktop / cold | 715 ms | 895 ms | 72 | 0 → 0 | 136 → 0 |
| Normal / desktop / warm | 160 ms | 389 ms | 72 | 0 → 0 | 136 → 0 |
| Normal / mobile / cold | 211 ms | 409 ms | 60 | 0 → 0 | 119 → 0 |
| Normal / mobile / warm | 105 ms | 275 ms | 60 | 0 → 0 | 119 → 0 |
| Throttled / desktop / cold | 3,252 ms | 19,547 ms | 72 | 21 → 0 | 79 → 0 |
| Throttled / desktop / warm | 564 ms | 1,230 ms | 72 | 9 → 0 | 121 → 0 |
| Throttled / mobile / cold | 2,931 ms | 12,956 ms | 60 | 5 → 0 | 107 → 0 |
| Throttled / mobile / warm | 637 ms | 1,112 ms | 60 | 0 → 0 | 119 → 0 |

The successful new runs made **exactly 72/60 frame fetch calls and 72/60 total decodes**, with no subsequent fetch/decode work during the traversal. The previous normal runs made 139/122 frame fetch calls, including HTTP-cache reads after decoded eviction. New cold frame bodies totaled exactly **2,770,034 bytes desktop / 1,627,620 bytes mobile**; new warm frame-body transfer was zero. The cold throttled baseline transferred only about 1.28 MB per profile because it cancelled/missed frames while scrolling. The full strategy deliberately transfers the entire profile before reveal.

### Loading and memory details

| New run | Screen preparation phase | Final frame-body completion since navigation | Aggregate decode latency |
| --- | ---: | ---: | ---: |
| Normal desktop cold / warm | 585 / 320 ms | 879 / 371 ms | 723 / 476 ms |
| Normal mobile cold / warm | 311 / 212 ms | 392 / 260 ms | 288 / 284 ms |
| Throttled desktop cold / warm | 17,761 / 790 ms | 19,495 / 1,202 ms | 768 / 800 ms |
| Throttled mobile cold / warm | 11,204 / 707 ms | 12,934 / 1,094 ms | 505 / 602 ms |

The preparation phase is measured from effect setup through successful Canvas draw; the 160 ms visual fade follows. Download and decode are pipelined through two slots, so aggregate per-image decode latency is **not additive wall-clock time or decoder CPU time**. It includes asynchronous completion/scheduling latency. Browser decoder workers are not necessarily slowed by CDP's main-thread CPU emulation.

Observed peak live decoded pixel accounting exactly matched the full sequence estimates: **149,299,200 bytes desktop / 69,984,000 bytes mobile**, versus the prior transient peaks of 26,956,800 / 8,164,800 bytes. ImageBitmap wrappers count `width × height × 4`, including transient live images; this is not an OS/GPU memory measurement. The successful path held one decoded object per frame, and cleanup tests returned tracked live bytes to zero.

### Rendering and tradeoffs

Canvas draw submission p95 remained **0.1 ms** in every before/after row. This measures synchronous `drawImage` submission, not GPU completion. The normal connection already had zero p95 requested-versus-painted lag, so no normal-network lag improvement is claimed. Under the throttled conditions, completing preparation eliminated measured loading-related lag, at the cost of a **roughly 20-second desktop / 13-second mobile wait from navigation**. The bypass link remains available throughout that wait.

Not every CPU metric improved. Measured scrolling main-thread task duration rose from 1,367→1,522 ms for normal cold desktop and 1,336→1,418 ms for normal cold mobile; throttled cold mobile rose 1,365→1,472 ms. Other rows improved, including throttled warm desktop 1,561→1,021 ms and mobile 2,070→1,171 ms. Normal runs had no observed long tasks over the complete observation. Throttled cold startup-plus-scroll runs had three desktop long tasks in both builds and three→four mobile. These single observations include audit overhead and do not establish causality or field responsiveness.

The existing 72/60 temporal samples still produce visible stepping at some scroll speeds, and midpoint blending can still show doubled architectural edges. Preloading does not create extra motion samples, change the blending curve, pre-upload every GPU texture, or solve all possible rendering stalls. The supported conclusion is narrower: **after successful preparation, the tested traversals needed no network downloads or asynchronous decodes and had zero p95 requested-frame lag.**

A supplemental normal-network audit isolated eight seconds of forward/reverse scrolling after preparation. Both builds, on both viewport profiles, recorded zero long tasks and zero p95 frame lag. Retained counts were 12/6 before and 72/60 afterward. This confirms the normal-network baseline was already responsive in this sample; it does not establish an improvement there. Raw results: `artifacts/full-frame-preloader/scroll-stalls.json`.

### Regression and failure verification

- TypeScript, lint, and production build pass. **18/18 unit tests pass**, including full-memory policy, genuine progress/Canvas completion, existing manifest/mapping/blending/timeline/form checks, and transport cancellation/retry tests. The Node TypeScript-stripping experimental notice remains test-tooling output.
- The 18-suite Chromium regression invocation passed 16 initially. Its story failure exposed a navigation regression: lower-page anchors were collapsing the film even after successful preparation. The handler was corrected to cancel only unfinished preparation, and the full story suite then passed on recheck. The remaining failure is the previously documented **Cormorant font-preload console warning** in `website-browser`; its interaction assertions completed, and neither its console assertion nor font configuration was weakened or changed.
- Firefox and Playwright WebKit each passed **4/4** suites: full preparation, safety timeout, active-profile/resize, and blending. This is not an actual Safari or physical-mobile session.
- New full-preparation checks cover desktop/mobile cold/warm visits, exact decoded counts at reveal, network routes forced to fail **after** reveal while all seeks still render, no repeat decodes, reversal, endpoints, idle freeze, one-profile fetching, delayed genuine progress, late entrance animation, bypass cleanup, failed-frame retries, low-memory poster fallback, and direct-anchor bypass.
- A simulated 2 GB device requested no sequence frames after the memory check. This tests policy behavior, not actual OS memory pressure. The 122-second mobile soak retained exactly 60 bitmaps across 40 seeks and orientation change, then released all of them on reduced-motion activation.
- The existing preparation suite verifies reduced-motion/Save-Data zero-frame behavior, pagehide/pageshow, reload preparation, slow manifests, failed assets, and no simultaneous duplicate requests. Its former three-frame and early-timeout assertions now check the explicitly requested full-sequence policy. Existing cache assertions now check exactly N retained images rather than the superseded 12/6 eviction limit.
- The missing-pair browser scenarios now verify that a network failure cannot affect an already retained pair, and that failure **during** initial preparation selects the poster. Pure adjacent-frame fallback tests remain intact. Renderer/blending/scroll-range assertions are unchanged.
- The clock-controlled 45-second deadline test verifies no early three-second reveal and a usable static fallback. Its initial Chromium CSS assertion ran before Motion's next mocked animation frame; advancing that mocked frame corrected the test, and the deadline check passed.
- The additional transient-failure test passed: one frame failed its first request, succeeded on its second, and preparation completed with all 72 frames retained without falling back. Results: `artifacts/hero-optimization/full-retry-final.json`.

Screenshots: [loading progress](../artifacts/full-frame-preloader/progress-mobile.png), [desktop ready](../artifacts/full-frame-preloader/ready-1440-cold.png), [mobile ready](../artifacts/full-frame-preloader/ready-375-cold.png). Raw comparisons: `artifacts/full-frame-preloader/{before,after}-{normal,slow}.json`. Browser results: `artifacts/hero-optimization/full-*.json`.

## Files and readiness

Runtime changes: `FrameLoader.prepareAll()`, preparation lifecycle/Canvas gating in `use-hero-sequence.ts`, `use-hero-preparation.ts`, `HeroPreparation.tsx`, `ScrollHero.tsx`, `full-frame-policy.ts`, configuration in `site.ts`, and the loading-screen CSS. Added focused tests and benchmark scripts; updated affected regressions to the new contract. `MOTION_REFERENCE.md` records the explicit policy replacement. The previous `CINEMATIC_PRELOADER.md` remains as the historical comparison report; README points here.

The final verification build reports JavaScript at **123.59 kB gzip**, versus 124.74 kB for the prior preloader; CSS is **6.76 kB**, versus 6.69 kB. No dependency changes or asset regeneration. The final rerun of TypeScript, lint, production build, and all 18 unit tests passed; the original source-video SHA-256 remains unchanged.

Ready for local review with the documented memory and slow-network costs. Physical phones, real Safari, actual OS/GPU memory pressure, and the new implementation on Vercel remain unverified; nothing was deployed. Retaining decoded images removes dependence on WebKit's previously observed HTTP-cache reuse behavior **during scrolling**, but its initial warm-visit loading may still differ on the deployed headers. The existing font warning and source-media licensing/watermark limitations remain. Do not interpret these results as universal smoothness, field Core Web Vitals, or commercial-publication approval.
