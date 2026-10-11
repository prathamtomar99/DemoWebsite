# Hero performance optimization

## Decision and scope

Use **72 desktop frames at 960×540** and **60 mobile frames at 720×405**, WebP quality 64 / effort 5. Both profiles sample the original video's complete first-to-last composition. The 500svh hero, deterministic `round(progress * (frameCount - 1))` mapping, four text stages, Canvas placement, poster fallback, source watermark, static alternatives, and all website interactions are preserved.

This is a local optimization awaiting review. Nothing has been committed, pushed, or deployed. The existing live site was inspected separately; optimized Vercel cold-cache behavior cannot be verified until an approved deployment.

## Asset comparison

| Candidate | Frames | Resolution | Format | Sequence bytes | MiB |
| --- | ---: | --- | --- | ---: | ---: |
| Original | 240 | 1280×720 | JPEG | 23,112,525 | 22.04 |
| Desktop A | 120 | 960×540 | WebP | 4,612,144 | 4.40 |
| Desktop B | 96 | 960×540 | WebP | 3,685,924 | 3.52 |
| **Desktop C** | **72** | **960×540** | **WebP** | **2,770,034** | **2.64** |
| Mobile A | 72 | 720×405 | WebP | 1,951,386 | 1.86 |
| **Mobile B** | **60** | **720×405** | **WebP** | **1,627,620** | **1.55** |
| Mobile C | 48 | 720×405 | WebP | 1,304,908 | 1.24 |

Selected desktop sequence is 88.0% smaller than the original; mobile is 93.0% smaller. Both deployable sequences total 4,397,654 bytes (4.19 MiB), before small manifests and the new 76,542-byte WebP poster (57.4% smaller than the 179,555-byte JPEG). A universal desktop sequence would save 1.55 MiB of deployment storage, but require mobile visitors to transfer 70% more sequence bytes and decode 78% more pixels per image. The small configuration-based variant selection is justified by that per-visitor saving.

The original MP4 remains outside `public/`, SHA-256 `279e8283475539b00d22fd6805f45f2b78be19aeb85e626e119b3d35555e9320`. No video modification, cropping, watermark concealment, synthetic scenes, or interpolation occurred. The first source index is 0; the last is 239 / timestamp 9.958333 s in every profile. The manifest's nominal 7.2/6 FPS describes source coverage, not playback speed.

## Runtime changes

- `site.ts` provides desktop and mobile manifests. `ScrollHero` chooses mobile below 768 CSS px once at mount. Resizing/orientation preserves the chosen sequence and frame mapping; Canvas layout and cache bounds still adapt. Reload after radically changing window size to select another resolution. No UA sniffing or cross-profile downloads.
- The manifest validator accepts safe nested JPEG/WebP paths and retains endpoint/path/count checks. Generated manifests include a content fingerprint; frame URLs carry it as a query parameter so regenerated profiles cannot reuse stale browser-cached images.
- Request/decode concurrency is two on both profiles. Both request the current frame and two nearby frames in the direction of travel. Cached earlier frames remain reusable, but no bandwidth is spent speculatively backfilling behind the current target. Current requests use high fetch priority, speculative neighbors low priority.
- Explicit ceilings are 12 desktop / 6 mobile frames (previously effectively 18 / 6). They prevent smaller images from expanding the cache. Existing byte limits, eviction, protected last-painted frame, pending deduplication, cancellation, retries, timeouts, stale-result rejection, offscreen suspension, and bitmap cleanup remain intact.
- `pagehide` suspends work and `pageshow` resumes it. A one-off 100 ms cooldown after genuine request failures prevents immediate retries in a departing WebKit document. Successful loads have no added delay; retries remain bounded and timers are cleaned up.
- Canvas diagnostics expose the active manifest/count for regression testing. No extra scroll listener, permanent animation loop, React update per pixel, Canvas remount, or timeline change.

## Reproducible preparation

`npm run prepare:hero` creates selected profiles under `public/frames/v2/{desktop,mobile}/`. Root `public/frames/manifest.json` is a compatibility desktop manifest referencing the same files. `npm run prepare:hero -- --candidates` creates all six test variants under ignored `artifacts/hero-optimization/candidates/`, outside deployment output.

FFmpeg/ffprobe inspect/decode the original. This installed FFmpeg has no WebP encoder; `cwebp` and Pillow were unavailable. Sharp was added **only as a development dependency** for reproducible WebP output, using its documented resize/WebP APIs. No system package or browser animation dependency was installed.

The pipeline verifies each decoded output, count, dimensions, aspect, unique monotonic source indices, endpoint coverage, and unchanged source checksum. It rejects HDR, unreviewed rotation/non-square pixels, symlink output directories, unowned profiles, and unexpected files in owned profile directories. Staging and process locking remain outside public output. Batch publication rolls back ordinary errors. The independent WebP poster is copied byte-for-byte from the verified first desktop frame; a replacement source requires visual review. Abrupt process termination still requires inspecting the staging directory/lock before cleanup.

## Measurement protocol

Production preview, Chromium on this macOS host, 1440×900 desktop and 375×812 mobile; DPR 1/2. One fresh browser context per size, cold HTTP cache first, then a warm reload in the same context. Each measured traversal is 12 seconds forward, six seconds reverse, then four rapid seeks 300 ms apart. Slow mode uses CDP 100 ms latency, 200,000 B/s download, 100,000 B/s upload, and 4× CPU slowdown. These are repeatable synthetic conditions, not a physical phone or field metric.

`benchmark-hero.mjs` instruments ImageBitmap creation/close, Canvas draw submission, current-versus-painted indices, long tasks, and CDP requests/transfers. Audit instrumentation is not shipped. Decoded memory counts RGBA bitmap dimensions, including transient decodes; it excludes Canvas backing store, HTTP cache, other images, JS, and GPU allocations. Draw timing measures synchronous submission, not GPU completion. The `poster` timing is response completion, a readiness proxy. Final runs also record actual poster paint through browser Element Timing (`posterPaint`); a separate original startup run provides the equivalent baseline. No field INP claim is made.

The initial trial overlapped image encoding; it is excluded. `original-clean.json` was rerun after encoding stopped. Benchmarks then ran sequentially without concurrent browser suites. Warm cache still requires decoding after the bounded bitmap cache evicts an image; HTTP-cache hits are requests but transfer no image body.

## Visual tradeoffs

Opening, entrance, and interior stills retain architectural lines, lighting, and the watermark. WebP loses fine foliage/texture detail relative to native 1280px JPEGs. No blur filter or sharpening masks this reduction. Desktop full-screen imagery now upscales a 960px source, so large/high-DPR screens look softer than the original.

Lower frame counts deliberately introduce stepping. At a steady 12-second traversal, ideal intervals are approximately 126 ms (96), 169 ms (72), 203 ms (60), and 255 ms (48). They are not 60 FPS video. Faster scrolling shortens these holds; stopped scrolling stays completely still. Endpoint stills alone cannot demonstrate smoothness; runtime traversals and requested/displayed lag are evaluated separately below.

## Selection evidence

The preferred 96/60 profiles were evaluated first. In the final directional-loader comparison at 1.6 Mbps/100 ms/4× CPU, desktop 96 had a cold p95 frame lag of 39 (41% of travel), versus 20 (28%) for desktop 72; warm p95 was 36 versus 19. Neither can download its entire sequence during a 12-second traversal at that bandwidth. Desktop 72 saves another 0.87 MiB and trades 126 ms ideal holds for 169 ms, accepted for this explicitly aggressive optimization.

Mobile 48 produced p95 cold lag of one frame with its smaller 1.24 MiB sequence, but creates 255 ms ideal holds during a slow 12-second traversal. Mobile 60 retains more entrance-motion continuity (203 ms holds) and, after directional loading, improved cold p95 lag from 14 to six frames and reached zero warm p95 lag. This remains a visible stepping tradeoff, not continuous-video smoothness. A later physical-phone review may prefer a different balance.

A 12-frame desktop cache reduced tracked transient peak from 37.6 MiB (18-frame WebP cache) to 25.7 MiB. No cache increase was used. Two look-ahead frames performed better than one on mobile. Backfill removal improved cold p95 lag, although it increased cancelled requests and worsened warm lag in the constrained desktop experiment; this regression is retained explicitly in the evidence, not hidden.

The initial candidate C experiments used a simple audit server with different startup delivery; their startup values are excluded from direct comparison. The later `tuned-*` / `directional-*` candidate runs used normal Vite production preview with middleware only for candidate manifest/image paths.

## Verification and final measurements

### Final production traversal measurements

Each row is one recorded run, not a median of repeated trials. Frame requests include HTTP-cache hits and cancelled requests. Completed frame transfer includes protocol overhead; partial bodies of cancelled requests are not included, so throttled transfer figures are not complete wire-byte totals. Warm throttled runs reuse only the images successfully fetched during the cold traversal, rather than an artificially fully primed cache.

| Build / device / cache | Frame requests | Completed frame transfer (MiB) | First Canvas (ms) | p95 frame lag | Peak decoded bitmap MiB | Long tasks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original normal / desktop / cold | 488 | 22.10 | 191.1 | 0 | 66.8 | 0 |
| Original normal / desktop / warm | 488 | 0.00 | 105.2 | 0 | 66.8 | 0 |
| Original normal / mobile / cold | 487 | 22.10 | 156.2 | 0 | 24.6 | 0 |
| Original normal / mobile / warm | 487 | 0.00 | 73.2 | 0 | 24.6 | 0 |
| Optimized normal / desktop / cold | 140 | 2.66 | 138.6 | 0 | 25.7 | 0 |
| Optimized normal / desktop / warm | 140 | 0.00 | 83.0 | 0 | 25.7 | 0 |
| Optimized normal / mobile / cold | 123 | 1.57 | 168.5 | 0 | 7.8 | 0 |
| Optimized normal / mobile / warm | 123 | 0.00 | 90.9 | 0 | 7.8 | 0 |
| Original throttled / desktop / cold | 482 | 1.01 | 5643.1 | 222 | 21.1 | 3 |
| Original throttled / desktop / warm | 482 | 0.00 | 599.2 | 222 | 21.1 | 0 |
| Original throttled / mobile / cold | 481 | 0.50 | 3942.5 | 225 | 10.5 | 3 |
| Original throttled / mobile / warm | 481 | 0.00 | 534.5 | 225 | 10.5 | 0 |
| Optimized throttled / desktop / cold | 140 | 1.25 | 2786.8 | 21 | 25.7 | 3 |
| Optimized throttled / desktop / warm | 139 | 0.29 | 580.4 | 9 | 25.7 | 0 |
| Optimized throttled / mobile / cold | 123 | 1.26 | 2405.3 | 5 | 7.8 | 3 |
| Optimized throttled / mobile / warm | 123 | 0.02 | 541.2 | 0 | 7.8 | 0 |

Normal-network cold traversal requests fell from 488 to 140 desktop (71.3%) and 487 to 123 mobile (74.7%). Final normal cold total page transfer was 3,205,403 bytes desktop and 2,146,930 mobile. Only three sequence requests occur during initial loading; the complete sequence is not preloaded. Normal warm frame-body transfer was zero.

Lag must be normalized when comparing counts: throttled cold desktop p95 fell from 222/239 (92.9% of sequence travel) to 21/71 (29.6%); mobile from 225/239 (94.1%) to 5/59 (8.5%). Optimized throttled warm p95 was nine desktop frames and zero mobile frames. Cold desktop still had 57 cancelled/failed frame requests and visible holds, versus 11 mobile. At this throughput the entire desktop sequence cannot arrive during a 12-second traversal. The previous painted image remains visible; all final benchmark rows recorded zero blank samples after first readiness. Final normal runs had zero sampled lag and no long tasks; throttled cold runs still had three long tasks each (maximum 131 ms desktop / 77 ms mobile).

Actual cold poster paint under throttling improved from 1,944 to 1,720 ms desktop and 1,904 to 1,620 ms mobile. This is the first useful architectural visual while Canvas loads. Warm poster paint worsened from 372 to 432 ms desktop and 400 to 412 ms mobile in these single runs. Normal mobile first Canvas also worsened from 156.2 to 168.5 ms cold and 73.2 to 90.9 ms warm; desktop improved. These small local timing regressions are retained rather than attributed confidently to the application from one sample. Network/asset and memory savings are much larger and repeatable from the actual files.

### Decode comparison across every candidate

All frames fetched and decoded once sequentially, in a separate isolated Chromium audit. Aggregate decode latency is elapsed decoding time, not measured CPU time. It does not include the extra redecodes caused by a bounded cache during reverse scrolling.

| Profile | Requests | Median decode ms | p95 decode ms | Aggregate decode ms |
| --- | ---: | ---: | ---: | ---: |
| original | 240 | 3.1 | 4.5 | 806.8 |
| desktop-a | 120 | 4.6 | 8.8 | 661.7 |
| desktop-b | 96 | 4.6 | 8.8 | 524.4 |
| desktop-c | 72 | 4.6 | 9.0 | 399.5 |
| mobile-a | 72 | 3.0 | 5.8 | 259.8 |
| mobile-b | 60 | 3.1 | 5.8 | 217.3 |
| mobile-c | 48 | 3.1 | 6.0 | 179.2 |

WebP is **not faster per desktop frame**: median isolated decode increased from 3.1 to 4.6 ms. Fewer/smaller images reduced aggregate sequence decoding from 806.8 to 399.5 ms desktop and 217.3 ms mobile. During normal scrolling, desktop median/p95 decode was 7.8/13.1 ms and mobile 5.0/8.7 ms; synchronous Canvas draw submission p95 was 0.1 ms on both. CPU throttling does not necessarily throttle browser image-decoder worker threads, so decode differences between modes should not be interpreted as CPU speed improvements.

All six candidates passed dimensions/count/endpoints checks and isolated decoding. Full comparative traversal testing concentrated on promising desktop 96/72 and mobile 60/48 profiles; desktop 120 and mobile 72 did not receive the full interaction/performance matrix. Desktop 120 preserves more temporal samples but is 4.40 MiB; mobile 72 adds 20% more frames/bytes at the same per-frame quality. Representative still comparisons showed the same compression character within a resolution; 48 mobile frames exhibited the largest motion steps. Selected 72/60 balances the requested aggressive savings against entrance-motion continuity.

### Live-site evidence and limits

The existing deployed mobile hero was inspected automatically. In its cold normal-network traversal it issued 480 frame requests, 476 were cancelled/failed, only seven Canvas draws completed, and p95 lag reached 225 frames. Warm traversal improved but still had 282 cancelled/failed requests and p95 lag of 93 frames. This reproduces the reported problem; it is not a controlled comparison against an optimized deployment. See `live-original.json`. The optimized site has **not** been pushed or deployed; Vercel delivery/cache behavior must be retested after separately approved deployment. No Lighthouse or field INP claim is made for this batch.

### Regression and visual verification

- TypeScript, lint (zero warnings), production build, and **9/9 unit tests** passed.
- **14/14 Chromium suites** passed, including all eight original suites, website/keyboard journeys, four story stages, exact endpoint/reverse selection, rapid seeks, resizing, delayed/failed images, poster fallback, Save-Data/reduced-motion, profile isolation, cache ceilings, and actual CTA destinations.
- **2/2 Firefox** and **2/2 WebKit** suites passed (QA and profile regressions). This is Playwright WebKit, not a manual Safari test.
- Additional final rechecks: **4/4 Chromium** and **1/1 Firefox** after the retry correction. A **122-second mobile soak** passed 40 seeks/orientation changes, bounded six-frame retained cache, idle drawing checks, and bitmap cleanup on reduced-motion activation.
- **3/3 pipeline safety checks** passed: unowned output directory, symlink output, and foreign file are rejected without deleting sentinel content. Dependency audit reported zero vulnerabilities.
- Initial WebKit QA exposed immediate failed-fetch retries during history navigation. Page lifecycle suspension alone was insufficient; the bounded failure cooldown resolved the access-control diagnostics. Final WebKit results contain no runtime errors. Existing assertions were preserved.
- The screenshot harness initially captured an old frame and an unfinished section reveal. It now waits for the exact expected frame and completed reveal; this was a capture synchronization defect, not a website blank-frame defect.
- Reviewed desktop 1440, tablet 768, and mobile 375 story compositions and property transition. Broader existing responsive checks include 320 px and landscape. No observed horizontal overflow, distortion, hidden watermark, or broken text timing. Mobile/tablet retain the approved contained footage composition. Lower-resolution desktop foliage is visibly softer; frame stepping is intentional.

### Assets, bundle, and changed files

The original 240 JPEGs and JPEG poster were retired from `public/` only after comparison against the saved baseline hashes. Historical copies/candidate variants and original production build stay under ignored `artifacts/`, outside deployment. `dist/` contains 132 selected WebP frames, three manifests, the WebP poster, and unchanged property media; no source MP4 or obsolete JPEG sequence. The source SHA-256 remains unchanged. Total deployable hero assets are **4,484,905 bytes (4.28 MiB)**, including manifests and poster, versus 23,297,241 bytes previously (80.7% smaller). Precise final totals are in `dist-verification.json`.

Production JS changed from **120.71 to 120.99 kB gzip** (+0.28 kB); CSS from **6.48 to 6.49 kB gzip**. The large saving is media transfer/decode work, not JS. Sharp is development-only.

Changed runtime files: `src/config/site.ts`, `src/components/hero/{ScrollHero.tsx,manifest.ts,frame-loader.ts,use-hero-sequence.ts}`, and `index.html`. Pipeline/dependency files: `scripts/prepare-hero.mjs`, `package.json`, `package-lock.json`, generated manifests/frames/poster. Added audit runners: `scripts/{benchmark-hero,audit-hero-candidates,serve-hero-candidates,run-browser-suites,test-hero-pipeline}.mjs`. Updated existing hero/QA tests for actual manifest counts and paths; added profile, throttled, soak, and screenshot tests. Documentation: this report, README, historical asset/implementation notices, and the current asset paragraph in MOTION_REFERENCE.md. No visual tokens or story timings changed; BRIEF.md and DESIGN.md are untouched.

### Review evidence and reproduction

All evidence is local under `artifacts/hero-optimization/` (ignored by Git):

- [Desktop opening](../artifacts/hero-optimization/final-1440-0.png), [desktop finale](../artifacts/hero-optimization/final-1440-95.png).
- [Tablet narrative](../artifacts/hero-optimization/final-768-25.png), [mobile interior](../artifacts/hero-optimization/final-375-65.png), [mobile properties](../artifacts/hero-optimization/properties-375.png).
- [Desktop scroll recording](../artifacts/hero-optimization/final-scroll-1440.webm), [mobile scroll recording](../artifacts/hero-optimization/final-scroll-375.webm). Recordings use the selected imagery/cache/timeline; later fingerprint/retry guards do not alter their visual composition.
- `original-clean.json`, `original-slow.json`, `original-startup.json`, `final.json`, `final-slow.json`, `candidate-decodes.json`, and `suites-*.json` contain individual measurements/results. Earlier experiments are retained with descriptive names; `*-before-*` files are historical, not final results.

Run `npm run build`, then `npm run preview -- --host 127.0.0.1 --port 4173`. `HERO_LABEL=review node scripts/benchmark-hero.mjs` repeats normal measurements; add `HERO_THROTTLE=1` for the throttled protocol. Local audit scripts use the existing Playwright installation and Chrome channel. Run suites with `node scripts/run-browser-suites.mjs hero-browser hero-resilience hero-profiles` (or the other test basenames); `BROWSER=firefox` / `BROWSER=webkit` selects installed engines. `node scripts/test-hero-pipeline.mjs` exercises safe output rejection.

### Readiness and remaining limitations

Ready for local review of the aggressive optimization. It substantially reduces transfer, requests, decoded memory, and constrained-network lag while preserving the site and deterministic hero behavior. It does not promise continuous-video smoothness or eliminate cold-network holds. Actual mobile hardware, manual Safari, production CDN cache behavior, and unusually large/high-DPR screens remain review points. The existing source watermark and licensing limitation remain; commercial publication still requires appropriate media rights/clean export where necessary. No backend, deployment, indexing, or unrelated feature changes were made. GitHub/Vercel updates require the user's next approval.
