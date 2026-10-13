# Frame loading concurrency benchmark

Status: experimental benchmark completed; production integration is not authorized and has not been performed.

Main collection: 2026-10-12 18:10–18:29 UTC (23:40–23:59 IST). Environment timestamps and individual observation timestamps are retained with the results.

## Recommendation

**Adopt independent 4-download / 2-decode scheduling as the next proposed production change, subject to separate approval and physical-device validation.** Use the same default for desktop and mobile. This experiment supports the scheduling change without changing frame count, WebP quality, blending, or the requirement to retain the complete sequence before reveal.

Under the controlled 1.6 Mbps, 100 ms latency, 4× CPU throttle, median navigation-to-Canvas readiness improved:

| Profile | Original production | Independent 4/2 | Reduction |
|---|---:|---:|---:|
| Desktop, 72 frames | 19.751 s | 16.348 s | 3.402 s / 17.2% |
| Mobile, 60 frames | 13.272 s | 10.597 s | 2.675 s / 20.2% |

Independent 6/2 improved on 4/2 by only 146 ms (0.89%) on desktop and 97 ms (0.92%) on mobile. Their trial ranges overlap. Five observations per cell do not establish a dependable advantage for six downloads. Four is the simpler, less aggressive choice supported by these measurements; different desktop/mobile defaults are not justified.

All 160 local timed navigations and four read-only live observations prepared every selected frame and passed scrolling checks. There were no preparation timeouts, retries, frame-request failures, duplicate work, or browser errors in those observations. The original harness reported 40 **early cleanup assertion failures**, discussed explicitly below; these were not preparation failures and were not removed from the data.

## 1. Existing architecture and verified bottleneck

The implementation was checked against `BRIEF.md`, `DESIGN.md`, `MOTION_REFERENCE.md`, the full-frame/cinematic preloader reports, hero performance/blending documentation, manifests, and existing tests. Current source controls this analysis.

| Source | Verified behavior |
|---|---|
| [frame-loader.ts](../src/components/hero/frame-loader.ts), `prepareAll`, `pump`, `load` | Full-sequence retention is enabled after the memory check. Two pending operations hold their slots through transport download, Blob acquisition, decode, validation, and settlement. A download finishing does not independently admit the next download. |
| [frame-transport.ts](../src/components/hero/frame-transport.ts), `read`, `pump`, `start` | A second hard cap of two active transports exists. Fetch uses the same versioned URLs and `force-cache`; frame zero receives higher priority. In-flight work is shared. Speculative warming is not active in this full-preparation path. |
| [use-hero-sequence.ts](../src/components/hero/use-hero-sequence.ts), `report`, render/scheduling callbacks | Completion requires the full cache and a successful Canvas draw. The existing 45-second preparation deadline instead selects the static fallback with `safety-timeout`. Reduced motion, Save-Data, visibility/page lifecycle, and disposal remain in this hook. |
| [full-frame-policy.ts](../src/components/hero/full-frame-policy.ts), `sequenceBudget` | Normal ceilings are 160 MiB desktop and 80 MiB mobile, with lower budgets on low-memory devices. Insufficient budgets select the static fallback before sequence loading. |

The original pipeline is effectively:

```text
manifest → memory check → two combined [download → decode → validate] slots
         → complete retained bitmap cache → successful Canvas draw → reveal
```

Network delivery dominates the throttled cold path: original downloads finish at median 19.728 s desktop / 13.250 s mobile, shortly before decode completion and Canvas readiness. Original average active downloads are about 1.95; average active decode calls are only 0.041–0.045 over the frame-loading window. Conversely, unlimited localhost is substantially decode/scheduling limited. Increasing only the transport cap would leave the original loader's two combined slots in place and would not implement the tested change.

The 45-second safety fallback was **not reached in any timed observation in this benchmark**. A separate injected deadline test verifies that all four configurations still take that fallback. These results do not prove that concurrency alone resolves every previously reported 45-second visit.

## 2. Experimental pipeline and isolation

[independent-loader.ts](../scripts/frame-concurrency/independent-loader.ts) implements:

```text
manifest → memory check → 2 / 4 / 6 download slots
         → bounded compressed Blob queue → exactly two decode slots
         → dimension validation → complete retained cache → existing Canvas/reveal
```

Four configurations distinguish scheduling improvements from concurrency improvements:

| Result name | Loader | Download cap | Decode cap |
|---|---|---:|---:|
| `production` | Original combined-slot implementation | 2 | 2, sharing the two combined slots |
| `separated-2` | Independent scheduling control | 2 | 2 |
| `separated-4` | Experiment A | 4 | 2 |
| `separated-6` | Experiment B | 6 | 2 |

The build-only Vite plugin redirects the hook's loader import and changes the transport cap in the experimental bundles. It does not edit either production source file. The original baseline receives only measurement callbacks, preserving its loader and transport scheduling. The hook gets the same preparation-start callback in all builds. Fetch/decode timing wrappers are injected into all browser contexts, including the live baseline.

Important invariants:

- Jobs remain keyed by original frame index. Completed/cached and in-flight indices are excluded from admission. Download completion releases admission independently of decode completion; ready blobs can enter the decode queue without waiting for earlier frame indices to complete.
- Eight reservations cover fetching plus buffered jobs; two decoding jobs may additionally hold their compressed blobs. Backpressure stops new fetching when these reservations are occupied. The reservation is made before starting a download.
- The fixed source frames are checked before building against a 128 KiB per-frame ceiling; a completed oversize blob is also rejected. With these verified assets, the conservative compressed payload reservation is at most ten × 128 KiB = 1.25 MiB, including the two decode inputs. This is not a bound on browser-internal network copies or total process memory, and it is not a streaming size limiter for arbitrary untrusted responses.
- Native `createImageBitmap` work cannot be cancelled synchronously. A cancelled decode continues occupying its real decode slot until its promise settles; a late result is closed. Suspension does not accidentally admit extra native decodes.
- The 12-second per-job deadline, 100 ms retry cooldown, one retry, dimension validation, memory eligibility, full retention, and disposal behavior remain. The per-job timer covers buffering as well as downloading/decoding. Transport cancellation and the existing 45-second global deadline remain active.
- The same frame URLs, manifest contents, WebP bytes, decoding API, renderer, scroll mapping, adjacent-frame blending, and storytelling components are used throughout. No assets were regenerated.

This is a full-preparation experiment, not a drop-in replacement for every historical windowed-loader mode: `configure` and `pin` are intentionally inert while the complete cache is retained. A future integration must preserve any other callers/modes rather than copying this class wholesale.

## 3. Methodology and environment

| Setting | Value |
|---|---|
| Host | Apple M2, 8 logical CPUs, 8 GiB installed RAM, Darwin 25.5.0 arm64 |
| Browser / runtime | Headless installed Chrome 155.0.8059.39; Node v26.7.0 |
| Browser tooling | Existing Playwright installation; no packages installed |
| Desktop | 1440×900 viewport, DPR 1, 72 frames at 960×540 |
| Mobile | 375×812 viewport, DPR 2, mobile/touch emulation, 60 frames at 720×405 |
| Normal local profile | Unlimited localhost throughput, no added latency, CPU rate 1 |
| Throttled profile | 200,000 B/s download (1.6 Mbps), 100,000 B/s upload, 100 ms configured latency, CPU rate 4 |
| Local delivery | HTTP/1.1; gzip HTML/JS/CSS/JSON; original public frame files; ETags and `public, max-age=0, must-revalidate` |
| Cold procedure | Fresh browser context and `Network.clearBrowserCache` before each pair |
| Warm procedure | Ordinary reload in that same context after cold preparation and correctness checks |
| Main sample | 4 configurations × 2 profiles × 2 network settings × 5 rounds × cold/warm = 160 navigations |
| Ordering | Configurations rotated each round and profile; all runs serial |
| Additional live sample | One desktop and one mobile cold/warm pair, original production only |

There was no shared experimental bandwidth load from parallel benchmark runs. “Cold” means cold browser HTTP cache, not a cold OS filesystem, CDN, browser executable, or machine. Contexts run sequentially in one browser process. The local server's filesystem/cache conditions are shared across all configurations. The server uses the same asset URLs for every configuration, with the HTML query choosing a build. No experimental deployment was created.

The normal local profile is a useful fast-delivery control, **not a measurement of normal internet access to Vercel**. Local HTTP/1.1 and Chrome's emulated throughput/latency are not identical to Vercel HTTP/2 delivery. The live pair cannot measure a production-versus-experiment improvement because no experiment was deployed.

### Measurement definitions

All completion timestamps below are **milliseconds from navigation start**, unless explicitly described as durations or queue waits. Readiness is the first observation of successful Canvas readiness after full retention. Reveal is `data-preparing=false`; overlay disappearance is separately observed after the fade. They are not interchangeable.

Manifest duration is Resource Timing duration. Download spans begin at actual `fetch` invocation and end after `response.blob()` resolves. Decode spans begin at actual `createImageBitmap` invocation and end at promise settlement. Peaks are measured from those spans, not from queued promises. Resource Timing independently checks the peak of uncached request-start/response-end spans. A fetch span includes browser request scheduling; it is not a direct count of TCP packets or sockets.

Average concurrency is the time integral of actual active operations divided by the first-fetch-to-Canvas interval. Download queue wait is admission time minus full-queue creation time; decode queue wait is decode start minus blob completion. Queue tables show the median of each trial's per-frame medians. Overlap is wall time with at least one fetch and one decode active. Summed overlapping decode latencies are available in JSON but are **not elapsed decode time or CPU utilization**.

Five successful cold and five warm trials exist in every local table row; no failed preparation trials were discarded. Empirical nearest-rank p95 with n=5 equals the slowest sample. It is not a reliable population-tail estimate. SD is descriptive dispersion with denominator n; no statistical significance claim is made.

## 4. Desktop comparison

### Throttled desktop

| Configuration | Cold median | Empirical p95 / slowest | Fastest | SD | Warm median | Gain vs production | Peak fetch/decode | Bitmap MiB | Prep failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Production | 19750.5 | 19846.8 | 19646.7 | 65.4 | 1111.3 | 0.0% | 2/2 | 142.4 | 0/10 |
| Independent 2/2 | 19393.0 | 19563.2 | 19060.3 | 202.7 | 979.6 | 1.8% | 2/2 | 142.4 | 0/10 |
| Independent 4/2 | 16348.4 | 16544.3 | 16327.5 | 84.2 | 986.8 | 17.2% | 4/2 | 142.4 | 0/10 |
| Independent 6/2 | 16202.4 | 16396.7 | 16193.1 | 96.9 | 970.8 | 18.0% | 6/2 | 142.4 | 0/10 |

### Normal localhost desktop

| Configuration | Cold median | Empirical p95 / slowest | Fastest | SD | Warm median | Gain vs production | Peak fetch/decode | Bitmap MiB | Prep failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Production | 408.9 | 478.0 | 396.3 | 32.6 | 341.2 | 0.0% | 2/2 | 142.4 | 0/10 |
| Independent 2/2 | 354.0 | 515.0 | 346.3 | 65.5 | 300.4 | 13.4% | 2/2 | 142.4 | 0/10 |
| Independent 4/2 | 367.5 | 417.5 | 364.8 | 20.0 | 314.7 | 10.1% | 4/2 | 142.4 | 0/10 |
| Independent 6/2 | 364.7 | 389.1 | 356.2 | 11.4 | 296.3 | 10.8% | 6/2 | 142.4 | 0/10 |

The bitmap column is a dimensions-based decoded-pixel estimate, not process RSS. Compressed-buffer overhead is reported separately below. “Failures” counts failed/timed-out preparations; cleanup assertion flags are separately accounted for.

## 5. Mobile comparison

### Throttled mobile

| Configuration | Cold median | Empirical p95 / slowest | Fastest | SD | Warm median | Gain vs production | Peak fetch/decode | Bitmap MiB | Prep failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Production | 13271.8 | 13526.5 | 13219.1 | 114.1 | 964.1 | 0.0% | 2/2 | 66.7 | 0/10 |
| Independent 2/2 | 13158.0 | 13321.5 | 13042.5 | 91.1 | 873.9 | 0.9% | 2/2 | 66.7 | 0/10 |
| Independent 4/2 | 10597.0 | 10825.6 | 10496.2 | 108.0 | 864.5 | 20.2% | 4/2 | 66.7 | 0/10 |
| Independent 6/2 | 10499.7 | 10545.9 | 10451.3 | 37.0 | 864.3 | 20.9% | 6/2 | 66.7 | 0/10 |

### Normal localhost mobile

| Configuration | Cold median | Empirical p95 / slowest | Fastest | SD | Warm median | Gain vs production | Peak fetch/decode | Bitmap MiB | Prep failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Production | 303.0 | 311.7 | 292.4 | 7.1 | 229.8 | 0.0% | 2/2 | 66.7 | 0/10 |
| Independent 2/2 | 259.0 | 361.8 | 244.0 | 42.8 | 205.8 | 14.5% | 2/2 | 66.7 | 0/10 |
| Independent 4/2 | 264.8 | 318.9 | 252.8 | 24.2 | 206.0 | 12.6% | 4/2 | 66.7 | 0/10 |
| Independent 6/2 | 251.1 | 269.1 | 246.8 | 7.7 | 212.6 | 17.1% | 6/2 | 66.7 | 0/10 |

### Attribution and diminishing returns

On the throttled connection, separating scheduling at 2/2 produces only a 1.8% desktop / 0.9% mobile median improvement over production. Increasing that independent pipeline from two to four downloads yields a further 3.045 s desktop / 2.561 s mobile reduction. Most of the large cold-network improvement therefore comes from increasing download concurrency, not merely rewriting the scheduler.

On unlimited localhost, separation itself improves the medians by 13.4% desktop / 14.5% mobile, while increasing beyond two downloads gives no consistent further benefit. Desktop `separated-2` even has a lower median than `separated-4`, alongside the largest outlier. This illustrates why a fast localhost result alone would be a poor concurrency decision.

With six downloads, per-frame delivery shares the same aggregate bandwidth across more requests. First-frame completion gets later, while full-sequence completion improves only slightly. Since the product intentionally waits for every frame, total readiness is the primary metric; later first-frame delivery could still matter for progress feedback or a future partial-preview design.

As a rough throughput-only lower bound, the unchanged frame bodies need 13.85 s desktop / 8.14 s mobile at 200,000 B/s, before startup resources, latency, and decode/reveal. Four downloads already approaches that constraint. This calculation is explanatory, not an additional benchmark result.

## 6. Pipeline, concurrency, and queue measurements

### Cold pipeline milestones

Manifest is a duration; the remaining columns are navigation-relative timestamps. Complete decode and retention agree at the displayed precision in the local runs. Each cell is independently aggregated, so subtraction of medians need not equal the median of per-trial differences.

| Network/profile | Configuration | Manifest | First download | All downloaded | All decoded / retained | Canvas | Reveal | Overlay gone |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| normal / desktop | Production | 1.0 | 106.6 | 391.2 | 396.4 | 408.9 | 410.0 | 576.7 |
| normal / desktop | Independent 2/2 | 0.9 | 100.9 | 324.7 | 348.5 | 354.0 | 355.5 | 522.9 |
| normal / desktop | Independent 4/2 | 1.6 | 116.3 | 336.9 | 360.9 | 367.5 | 370.7 | 544.0 |
| normal / desktop | Independent 6/2 | 0.9 | 110.1 | 327.8 | 352.8 | 364.7 | 366.2 | 531.9 |
| normal / mobile | Production | 0.8 | 108.3 | 292.1 | 295.8 | 303.0 | 305.4 | 469.5 |
| normal / mobile | Independent 2/2 | 0.8 | 99.2 | 231.4 | 246.4 | 259.0 | 261.2 | 426.0 |
| normal / mobile | Independent 4/2 | 1.0 | 107.1 | 231.9 | 248.5 | 264.8 | 265.9 | 432.0 |
| normal / mobile | Independent 6/2 | 0.7 | 100.1 | 228.6 | 245.9 | 251.1 | 252.3 | 418.4 |
| throttled / desktop | Production | 133.7 | 2672.6 | 19728.1 | 19735.0 | 19750.5 | 19768.9 | 19950.0 |
| throttled / desktop | Independent 2/2 | 133.4 | 2664.6 | 19366.7 | 19374.9 | 19393.0 | 19404.2 | 19578.6 |
| throttled / desktop | Independent 4/2 | 135.0 | 3436.3 | 16320.7 | 16329.2 | 16348.4 | 16354.6 | 16533.0 |
| throttled / desktop | Independent 6/2 | 134.2 | 4179.8 | 16187.0 | 16194.2 | 16202.4 | 16209.7 | 16388.6 |
| throttled / mobile | Production | 133.0 | 2418.1 | 13249.9 | 13256.1 | 13271.8 | 13281.4 | 13470.0 |
| throttled / mobile | Independent 2/2 | 134.1 | 2417.7 | 13143.1 | 13150.0 | 13158.0 | 13164.3 | 13344.4 |
| throttled / mobile | Independent 4/2 | 132.5 | 2928.4 | 10580.6 | 10587.3 | 10597.0 | 10602.9 | 10783.8 |
| throttled / mobile | Independent 6/2 | 132.6 | 3424.0 | 10488.3 | 10494.0 | 10499.7 | 10507.0 | 10681.0 |

### Actual concurrency and waiting

| Network/profile | Configuration | Average fetches | Average decodes | Fetch queue wait | Decode queue wait | Download/decode overlap |
|---|---|---:|---:|---:|---:|---:|
| normal / desktop | Production | 0.403 | 1.495 | 175.5 | 0.0 | 57.6 |
| normal / desktop | Independent 2/2 | 0.549 | 1.905 | 121.3 | 22.0 | 100.3 |
| normal / desktop | Independent 4/2 | 0.651 | 1.864 | 126.0 | 21.6 | 100.3 |
| normal / desktop | Independent 6/2 | 0.650 | 1.859 | 128.4 | 21.5 | 93.0 |
| normal / mobile | Production | 0.528 | 1.367 | 110.7 | 0.0 | 33.1 |
| normal / mobile | Independent 2/2 | 0.643 | 1.860 | 74.2 | 14.8 | 73.4 |
| normal / mobile | Independent 4/2 | 0.786 | 1.761 | 71.4 | 14.9 | 72.0 |
| normal / mobile | Independent 6/2 | 0.815 | 1.838 | 70.5 | 14.7 | 67.1 |
| throttled / desktop | Production | 1.954 | 0.041 | 11286.2 | 0.1 | 603.6 |
| throttled / desktop | Independent 2/2 | 1.993 | 0.047 | 11047.4 | 0.1 | 739.6 |
| throttled / desktop | Independent 4/2 | 3.955 | 0.054 | 9420.7 | 0.1 | 717.9 |
| throttled / desktop | Independent 6/2 | 5.914 | 0.053 | 9158.1 | 0.1 | 678.4 |
| throttled / mobile | Production | 1.945 | 0.045 | 7015.0 | 0.1 | 442.7 |
| throttled / mobile | Independent 2/2 | 1.990 | 0.049 | 6882.2 | 0.1 | 491.2 |
| throttled / mobile | Independent 4/2 | 3.945 | 0.058 | 5700.4 | 0.1 | 477.5 |
| throttled / mobile | Independent 6/2 | 5.867 | 0.059 | 5420.9 | 0.1 | 454.7 |

Measured peak downloads were exactly 2, 2, 4, and 6 for the respective configurations; peak decodes were two throughout. Uncached Resource Timing peaks also reached the matching configured download caps. No measured limit was exceeded. Normal local delivery keeps the decoders relatively busy, while throttled delivery leaves them mostly idle between arrivals. Warm-cache runs can fill the bounded compressed queue even though throttled cold runs are network limited.

## 7. Requests, caching, memory, and browser behavior

### Request and cache accounting

| Local profile | Cold startup request events | Warm startup request events | Cold frame cache misses | Warm frame cache hits | Encoded sequence bodies | Cold frame Resource Timing transfer | Warm frame transfer |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop | 80 | 83 | 72 | 72 | 2,770,034 B | 2,791,634 B | 0 B |
| Mobile | 68 | 70 | 60 | 60 | 1,627,620 B | 1,645,620 B | 0 B |

These counts are CDP request events, including cache-served resources, not a claim that every event transferred bytes over the network. Startup accounting ends after the loader transition, before the scrolling exercise. Warm reloads can schedule additional previously exposed/lazy page resources; their frame work remains exactly 72 or 60 fetch/decode calls. Local total transferred bytes were 3,049,568–3,049,827 desktop cold and 1,903,489–1,903,748 mobile cold, with small bundle differences between builds. Warm totals were 3,001 B desktop / 2,714 B mobile. Resource Timing frame transfer adds the browser's header estimate; encoded body size is the exact payload comparison.

All local warm frames had zero transferred bytes despite fresh decode calls. The improvement is strongly attributable to browser HTTP resource reuse under the existing `force-cache` path; a reload constructs and decodes a new full bitmap cache. The data does not establish persistent reuse of the previous page's decoded ImageBitmaps. No alternative warm loader path was introduced. Caching headers and URLs were deliberately held constant, so this experiment does not estimate the benefit of changing caching policy.

### Memory and buffer bounds

| Configuration | Desktop retained bitmap estimate | Mobile retained bitmap estimate | Maximum desktop compressed queue | Maximum desktop queue + decode blobs | Maximum mobile compressed queue | Maximum mobile queue + decode blobs |
|---|---:|---:|---:|---:|---:|---:|
| Production | 142.4 MiB / 72 | 66.7 MiB / 60 | 76.8 KiB | 152.2 KiB | 51.6 KiB | 102.8 KiB |
| Independent 2/2 | 142.4 MiB / 72 | 66.7 MiB / 60 | 593.0 KiB | 742.7 KiB | 383.4 KiB | 486.1 KiB |
| Independent 4/2 | 142.4 MiB / 72 | 66.7 MiB / 60 | 593.0 KiB | 742.7 KiB | 397.5 KiB | 498.1 KiB |
| Independent 6/2 | 142.4 MiB / 72 | 66.7 MiB / 60 | 593.0 KiB | 742.7 KiB | 397.5 KiB | 498.1 KiB |

Peaks above cover cold and warm observations, both network settings. Maximum waiting compressed count was eight in the independent pipeline. Exact decoded-pixel estimates were 149,299,200 B desktop and 69,984,000 B mobile, unchanged across configurations and within existing ceilings. The maximum source frame was 78,646 B desktop / 52,810 B mobile.

The largest observed compressed payload held by the separated pipeline, including decode inputs, was 760,524 B (0.725 MiB) desktop and 510,056 B (0.486 MiB) mobile. This is small compared with unchanged bitmap retention. Blob accounting and width×height×4 do not include Canvas backing stores, GPU copies, decoder working memory, HTTP cache, or all JS allocations. `performance.memory` snapshots are retained as limited heap observations; they are not a defensible total-memory measurement. Physical iOS memory-pressure safety remains unverified.

### Main-thread responsiveness and scrolling

No startup long tasks were observed in the normal local cold runs. Every throttled cold run recorded three long tasks; the longest task across them was 89 ms, with similar counts and durations across configurations. Startup rAF p95 was approximately 16.8 ms under throttle, but isolated gaps around 339–358 ms also occurred. This is not a claim that startup was uniformly smooth. The initial probe-to-first-rAF interval is not a steady-state frame interval and should not be interpreted as one. A full attributed CPU trace was not collected. The raw CDP task-duration difference can reset across navigation and is not used to claim CPU savings.

For each of the 160 local runs and four live observations, the post-preparation exercise checked continuous forward and reverse scrolling, stable positions covering all four story stages, a fractional adjacent-frame blend, and rapid contradictory jumps ending at the expected final frame. Canvas pixels were sampled for nonuniform content after startup measurement, and frame mapping/blend availability were checked during traversal. All passed, with zero extra frame downloads or decodes and no idle repaint loop. This samples rendering correctness; it cannot prove every pixel of every possible scroll trajectory.

Across local traversal samples, p95 rAF spacing was 16.7–16.8 ms, maximum spacing was about 33.4 ms, and no traversal long tasks were observed. This supports preserved smoothness in the tested Chrome environment. Screenshots of the ready desktop and mobile 4/2 views were also inspected. They preserve the intended full-screen desktop composition and mobile image/text layout.

There were zero browser page errors, console errors, or network failures in the timed sample. The Canvas `getImageData` performance warning comes from the harness's post-startup pixel checks; it is not evidence that production should enable `willReadFrequently`.

### Cleanup assertion correction — retained in the evidence

The first main runner checked bitmap release only 30 ms after requesting reduced motion on warm pages. All 40 CPU-throttled warm observations, including original production, still had pending media-query/React cleanup at that instant and were recorded as `Bitmap cleanup failure`. The main command consequently returned exit status 1. **Those original flags and raw results remain unchanged.** Preparation and scrolling had already completed successfully, before this assertion.

A dedicated recheck used the same built variants, both profiles, warm cache, identical network/CPU throttle, and the same scrolling exercise. It waited for the observable static state and zero tracked live bitmaps, with a five-second ceiling. All eight cases passed; release completed 57.1–88.8 ms after the media-change request. The recheck reproduces the too-early observation and supports a test synchronization error rather than a retained-bitmap leak. It is a new representative check, not a retrospective rewrite or rerun of all 40 original observations.

The retained runner now waits for that condition. The probe additionally timestamps the last `close()` for this diagnosis. Neither change modifies the experimental loader or the timed startup path. See [cleanup-recheck.json](../artifacts/frame-concurrency/main-01/cleanup-recheck.json).

## 8. Read-only live Vercel observations

Original deployment: <https://demo-website-nine-tan.vercel.app/>. One pair per profile; these are observations, not a statistical comparison.

| Profile/cache | Canvas ready | Downloads complete | Decodes complete | Reveal begins | Overlay gone | Manifest duration | Startup request events |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop cold | 4966.6 | 4956.5 | 4962.5 | 4968.2 | 5134.2 | 58.7 | 80 |
| Desktop warm | 413.0 | 402.6 | 408.1 | 414.1 | 580.3 | 22.6 | 83 |
| Mobile cold | 2683.7 | 2663.7 | 2673.7 | 2685.4 | 2853.1 | 105.5 | 68 |
| Mobile warm | 300.5 | 281.9 | 285.9 | 301.5 | 467.5 | 15.1 | 70 |

All used actual 2/2 peaks and retained 72/60 frames at readiness. Exact per-frame cache-insertion timestamps are unavailable live because the production bundle has no benchmark retention callbacks; `allRetainedMs` is therefore null rather than invented. Readiness/cache count and decode completion establish successful full preparation.

Actual frame responses used HTTP/2 and `cache-control: public, max-age=0, must-revalidate`. Desktop cold had 67 `x-vercel-cache: HIT` and five `MISS`; mobile cold had 60 `HIT`. Thus even these two cold browser observations did not have identical CDN conditions. Warm frame transfers were zero for all 72/60 frames. Cached responses retain their original CDN headers, so an `HIT` header on a disk-cache response does not prove a new CDN request.

Total startup transfer was 3,045,106 B desktop cold / 1,899,765 B mobile cold and 772 B / 766 B warm. No safety fallback or long task was observed in these four runs. There is no measured experimental Vercel improvement to report.

## 9. Validation and reproducibility

Checks completed:

| Check | Result |
|---|---|
| Project TypeScript, `npm run typecheck` | Passed |
| Experimental TypeScript, `tsc -p scripts/frame-concurrency/tsconfig.json --noEmit` | Passed |
| Project lint, `npm run lint` | Passed, including retained benchmark files |
| Existing unit suite, `npm test` | 18/18 passed |
| Experimental unit suite | 6/6 passed: blocked decoders/backpressure, cancellation slots/late close, bounded retry, dimension rejection, memory eligibility, concurrency integration |
| Original production Vite build to isolated output | Passed; same original `index-CcorsY4_.js` and `index-DGeYixNh.css` hashes |
| Four experimental Vite builds | Passed; output isolated under artifact directories |
| Preliminary browser smoke sample | 16/16 preparations and scrolling exercises passed |
| Browser fault/lifecycle scenarios | 36/36 passed across four configurations |
| Main timed sample | 160/160 local preparations and scrolling checks passed; original 40 early cleanup flags preserved |
| Live baseline | 4/4 preparations and scrolling checks passed |
| Dedicated throttled warm cleanup recheck | 8/8 passed |
| Production source/asset inventory | Unchanged before/after the benchmark |

The 36 fault/lifecycle scenarios cover transient failure with one retry, permanent HTTP failure with bounded attempts, corrupt WebP, low-memory fallback before any frame request, reduced motion, Save-Data, navigation bypass cleanup, page lifecycle suspension/resumption, and the global deadline using a virtual clock. These tests are separate from the successful timing sample. They are not a broad real-network reliability study.

Run from the repository root with the existing dependencies and installed Chrome:

```sh
node --test scripts/frame-concurrency/loader.test.mjs
./node_modules/.bin/tsc -p scripts/frame-concurrency/tsconfig.json --noEmit
npm run typecheck
npm run lint
npm test
node scripts/frame-concurrency/run.mjs --output artifacts/frame-concurrency/reproduction-01 --trials 5 --networks normal,throttled --live
node scripts/frame-concurrency/summarize.mjs artifacts/frame-concurrency/reproduction-01
node scripts/frame-concurrency/verify.mjs artifacts/frame-concurrency/reproduction-01
node scripts/frame-concurrency/verify-cleanup.mjs artifacts/frame-concurrency/reproduction-01
```

The runner refuses to overwrite an existing output directory. Change `reproduction-01` for subsequent runs. Omit `--live` for a fully local experiment. `PLAYWRIGHT_PATH` can point to an already installed Playwright package; this machine uses `/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright`. The scripts do not install dependencies. The programmatic Vite build approach was checked against current Vite documentation through the operational Context7 MCP.

Raw evidence retained locally (artifact directories are ignored by Git):

- [Environment and throttle settings](../artifacts/frame-concurrency/main-01/environment.json).
- [Every main observation and metrics](../artifacts/frame-concurrency/main-01/results.json).
- [Per-navigation raw Resource Timing, probe events, timing, memory, and checks](../artifacts/frame-concurrency/main-01/raw/).
- [Aggregated results](../artifacts/frame-concurrency/main-01/summary.json).
- [Source/asset SHA-256 inventory](../artifacts/frame-concurrency/main-01/source-inventory.json) and [unchanged result](../artifacts/frame-concurrency/main-01/integrity.json).
- [Fault/lifecycle test results](../artifacts/frame-concurrency/smoke-01/verification.json).
- [Cleanup recheck](../artifacts/frame-concurrency/main-01/cleanup-recheck.json).
- [Desktop 4/2 screenshot](../artifacts/frame-concurrency/main-01/separated-4-desktop.png) and [mobile 4/2 screenshot](../artifacts/frame-concurrency/main-01/separated-4-mobile.png).

The report contains the key results even when the ignored artifacts are not present in another checkout. Preserve the artifact directory separately if sharing raw evidence.

### Every added or modified project file

No pre-existing tracked file was modified. Added files:

| File | Purpose |
|---|---|
| `docs/FRAME_CONCURRENCY_BENCHMARK.md` | This report |
| `scripts/frame-concurrency/independent-loader.ts` | Benchmark-only independent scheduler |
| `scripts/frame-concurrency/tsconfig.json` | Type check the isolated loader |
| `scripts/frame-concurrency/build.mjs` | Isolated Vite builds and source/asset inventory |
| `scripts/frame-concurrency/server.mjs` | Controlled local delivery of unchanged public assets |
| `scripts/frame-concurrency/browser-probe.mjs` | Browser observations and scrolling checks |
| `scripts/frame-concurrency/metrics.mjs` | Metric definitions and interval integration |
| `scripts/frame-concurrency/run.mjs` | Serial rotated cold/warm benchmark runner |
| `scripts/frame-concurrency/summarize.mjs` | Aggregation of preserved results |
| `scripts/frame-concurrency/loader.test.mjs` | Targeted scheduler safety tests |
| `scripts/frame-concurrency/verify.mjs` | Browser failure/fallback/lifecycle verification |
| `scripts/frame-concurrency/verify-cleanup.mjs` | Condition-based cleanup diagnosis |

Generated ignored files are confined to `artifacts/frame-concurrency/smoke-01/`, `artifacts/frame-concurrency/main-01/`, `artifacts/frame-concurrency/production-validation-build/`, and normal TypeScript cache output under `node_modules/.tmp/`. Original `dist`, public assets, dependencies, project configuration, and production source were not replaced. No commit, push, or deployment was made.

## 10. Confidence, limitations, and proposed production changes

Confidence is high that the retained experiment really achieves independent 4/2 and 6/2 scheduling with bounded compressed backlog and unchanged complete-frame retention. Confidence is moderate that 4/2 is the best next default: its large improvement over production repeats across all throttled trials on both emulated profiles. Confidence is low in any precise internet-wide percentage, any meaningful superiority of 6/2, or claims about physical Safari/iOS memory behavior.

Remaining work before shipping would include physical mid-range Android and iPhone/Safari checks, actual HTTP/2 or HTTP/3 delivery with controlled comparable cache conditions, a larger sample across latency/throughput combinations, and memory-pressure/long-background lifecycle tests. Chrome CPU throttling does not model a mobile GPU, decoder implementation, thermal throttling, or OS memory limits. This small sample cannot establish rare failure rates. The probe adds equal observation overhead but does not eliminate all instrumentation effects. Normal and throttled profiles also change CPU rate together; only comparisons within a profile isolate configuration.

If the user approves production work, the necessary changes are:

1. In `frame-loader.ts`, introduce independent download and decode accounting for full preparation. Keep two actual native decodes, release download admission after Blob completion, and use bounded compressed reservations/backpressure as tested. Preserve index-keyed deduplication, validation, one retry, timeouts, and cancellation-held decode slots. Preserve existing non-full-retention behavior for any remaining callers.
2. In `frame-transport.ts`, make the full-preparation download cap agree with the loader's four-download limit. Changing this file alone is insufficient. Preserve URL versioning, cache mode, request priority, in-flight sharing, and abort semantics.
3. In `use-hero-sequence.ts`, pass the independent full-preparation policy while keeping the existing complete-cache plus successful-draw readiness gate. Preserve static fallback behavior, 45-second deadline, visibility/page lifecycle handling, and cleanup.
4. Keep existing `full-frame-policy.ts` memory ceilings and selected manifests. Adopt a documented bounded-Blob policy; validate its per-frame assumptions when future media assets change. A general production implementation should enforce a suitable byte bound rather than silently relying forever on this experiment's fixed-assets size check.
5. Port the meaningful scheduler/failure/cancellation tests and add physical-browser checks. Use observable completion conditions for asynchronous cleanup assertions. Remove benchmark-only callbacks from shipping builds; retain the isolated harness for regression measurement.

No frame, format, compression, blending, Canvas, scroll-height, story-timing, loader-design, accessibility-fallback, cache-header, or Vercel-configuration change is required to realize the scheduling benefit measured here. Those would be separate experiments. The single next engineering action supported by this benchmark is an approved, tested integration of independent **4 downloads / 2 decodes**, with the full-readiness contract preserved.
