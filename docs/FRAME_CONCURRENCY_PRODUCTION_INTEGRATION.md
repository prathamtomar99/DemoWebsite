# Independent frame loading — production integration

## A. Summary

Implemented and validated locally on 13 October 2026. The production full-preparation path now allows **four independent downloads and two decodes** on both desktop and mobile. No commit, push, or deployment was performed.

The real integrated source reduced median cold navigation-to-Canvas readiness under the controlled throttle:

| Profile | Original production 2/2 | Integrated production 4/2 | Reduction |
|---|---:|---:|---:|
| Desktop | 19.393 s | 16.423 s | 2.970 s / **15.3%** |
| Mobile | 13.077 s | 10.612 s | 2.465 s / **18.9%** |

All 40 measured navigations succeeded, with five cold and five warm observations per device/configuration. The candidate reached four actual concurrent downloads and no more than two decodes, retained exactly 72 desktop / 60 mobile bitmaps, and performed no additional frame downloads or decodes during prepared scrolling. There were no timed-sample retries, timeouts, request failures, browser errors, or cleanup failures.

The integrated cold medians are only 0.46% desktop / 0.14% mobile above the earlier isolated 4/2 medians. This does not indicate a substantial integration slowdown. These are local synthetic measurements, not a deployed Vercel speed claim.

## B. Architecture

Previously:

```text
Manifest → memory eligibility → two combined [download → decode] slots
         → complete bitmap cache → successful Canvas draw → reveal
```

Now, for full preparation:

```text
Manifest → unchanged memory eligibility → four download slots
         → bounded compressed Blob queue → two decode slots
         → dimension validation → complete bitmap cache
         → successful Canvas draw at current scroll position → reveal
```

`FrameLoader.pending` stores index-keyed jobs with `fetch`, `buffer`, or `decode` phases. `pump()` admits buffered jobs to free decode slots and independently admits downloads. Receiving a Blob changes its phase immediately; it does not hold the download slot until decoding finishes. Available bodies can decode out of download order. Cache and pending lookups prevent duplicate work.

The transport independently enforces its configured four-request limit. Its original default remains two for historical windowed callers. The hero hook passes the full-preparation limits explicitly. Existing versioned URLs, `force-cache`, first/current-frame priority, shared in-flight requests, and speculative-warmer behavior are preserved. Full preparation still does not enable speculative warming.

The historical loader interfaces were retained rather than replaced by the simplified benchmark class: windowed `want`, directional priorities, companion requests, combined-slot admission, configurable concurrency, LRU reuse, pinning, eviction, `configure`, and the HTMLImage fallback remain. Full retention continues to ignore windowed cache reconfiguration, keeping the selected manifest and memory ceiling latched.

The Canvas renderer, nearest-frame calculation, adjacent-frame blending, scroll height, four story windows, opening animation, and React scrolling path were not changed. The reveal gate still requires the complete retained cache and a successful Canvas draw. No partial cinematic reveal or artificial delay was added.

## C. Files modified

### Production source

| File | Change |
|---|---|
| [frame-loader.ts](../src/components/hero/frame-loader.ts) | Phase-aware jobs and independent full-preparation scheduling; separate Blob decode; bounded reservations; cancellation-safe settlement; original windowed behavior retained. |
| [frame-transport.ts](../src/components/hero/frame-transport.ts) | Configurable transport concurrency and compressed-byte limit; streaming response validation; failed HTTP bodies cancelled before releasing admission. |
| [full-frame-policy.ts](../src/components/hero/full-frame-policy.ts) | Shared full-preparation policy: four downloads, two decodes, eight compressed reservations, 256 KiB maximum compressed frame. Existing decoded-memory calculations and ceilings unchanged. |
| [use-hero-sequence.ts](../src/components/hero/use-hero-sequence.ts) | Pass the full transport policy; immediately dispose preparation resources on failure; reject late manifest continuation after failure; resume only while near, active, visible, and not failed. Existing complete-cache/Canvas readiness gate retained. |

### Tests and supporting tools

| File | Change |
|---|---|
| `tests/frame-loader.test.mjs` | Added 12 focused production scheduler tests. |
| `tests/frame-transport.test.mjs` | Added six tests for actual four-request admission, shared bodies, streamed size bounds, cancellation, and HTTP error-body cleanup. |
| `tests/hero-browser.js` | Pending-job bound now accounts for eight reservations plus two decode inputs; corrected a hardcoded URL concatenation so the preview override applies to the responsive manifest request. |
| `tests/hero-preparation.js` | Measure streamed response completion, require actual four-download admission, and assert at most two decodes. |
| `tests/hero-resilience.js` | Preserve bitmap/cache assertions with the new pending-job bound; condition-based disposal check. |
| `tests/hero-soak.js` | Condition-based disposal check instead of a fixed sleep. |
| `scripts/frame-concurrency/build.mjs` | Rebuild the original baseline from a pinned Git revision; add a candidate build using actual integrated source; record provenance. No scheduler replacement or concurrency transform applies to the integrated candidate. |
| `scripts/frame-concurrency/server.mjs` | Serve the configurations actually present in the output directory. Delivery/cache policy unchanged. |
| `scripts/frame-concurrency/browser-probe.mjs` | Observe streamed-body completion and associate the completed Blob with its frame for decode/queue accounting. These hooks exist only in audit builds/browser injection. |
| `scripts/frame-concurrency/run.mjs` | Add `--integration` for serial original-versus-integrated comparisons with the existing throttle and condition-based cleanup assertion. |
| `scripts/frame-concurrency/summarize.mjs` | Aggregate configurations from recorded results, including the integrated candidate. |
| `scripts/frame-concurrency/verify.mjs` | Discover built configurations; add held-final-frame, visibility, dimension, oversize, and per-job deadline cases; await actual cleanup. |
| `scripts/frame-concurrency/verify-cleanup.mjs` | Discover built configurations so the existing condition-based diagnostic also supports integration builds. |
| `scripts/frame-concurrency/verify-strictmode.mjs` | Added a development StrictMode and delayed-native-decode cleanup check. |

The experimental `independent-loader.ts`, its six unit tests, and the original metric definitions remain available as reference. The benchmark infrastructure and earlier benchmark report were already untracked work from the preceding task; they were not discarded or committed.

Documentation: added this report; updated only the concurrency sentence in `MOTION_REFERENCE.md` and the loader architecture bullet in `docs/FULL_FRAME_PRELOADER.md`. The latter identifies its older measurements as historical. `BRIEF.md`, `DESIGN.md`, other website components, assets, manifests, package files, Vite/Vercel configuration, and cache headers remain unchanged.

## D. Safety and memory

### Compressed responses

Eight reservations cover jobs currently fetching or waiting for decoding. At most two additional jobs hold decode inputs. Admission stops when the reservation count is full. The maximum accepted compressed body is **256 KiB**; the normal full-preparation payload reservation is therefore `(8 + 2) × 256 KiB = 2.5 MiB`.

This replaces the experiment's assumption that fixed files are below 128 KiB. The transport checks `Content-Length` for early rejection, but also counts every streamed chunk before retaining it. Missing or understated headers cannot bypass the byte limit. Oversized bodies are cancelled and fail through the existing one-retry/static-fallback path. There is no unlimited `response.blob()` allocation in the full-preparation transport path. The loader also validates the resulting Blob size defensively.

Future assets may be larger than the current ones; bodies up to 256 KiB are supported without depending on present dimensions/compression. Larger frames intentionally require a reviewed policy change or select the poster fallback. This is a bounded admission policy, not a promise to accept arbitrary future asset sizes.

The payload reservation is not an OS-memory ceiling: stream delivery chunks, chunk-to-Blob copying, browser networking/cache, allocator overhead, Canvas/GPU resources, and delayed garbage collection can add transient memory. Measured completed-Blob storage below also excludes partial responses still being streamed.

### Decoding, cancellation, and retries

- Exactly two native decode promises can be outstanding in full preparation. Cancellation does not release a decode slot until its promise settles. Late results are closed and cannot enter the cache.
- Buffered jobs settle immediately on cancellation because they have no active asynchronous decode. Fetches use the existing abortable, shared transport. Suspending retains already cached frames but stops admission and clears retry work.
- Each selected index has at most one pending job and one retained decoded object. Job-identity checks prevent stale settlement from deleting replacement work. Dimension validation precedes retention; wrong-size images are closed.
- Genuine failures and timeouts receive one retry after the existing 100 ms cooldown. Suspension, supersession, and disposal do not consume retries. HTTP failure bodies are cancelled before their network slots are released.
- The 12-second per-job timer remains unchanged and covers fetch, buffered waiting, and decode. Native decoding cannot be forcibly interrupted, so a timed-out decode holds its slot until settlement. The independent 45-second global deadline still selects the static fallback; it was not extended.
- Failure now disposes the loader and transport immediately, and a late manifest cannot restart failed preparation. Unmount/static-mode cleanup remains idempotent. Page visibility, pagehide/pageshow, and intersection callbacks cannot resume loading while hidden, inactive, distant, or failed.

### Measured memory

| Profile | Retained/peak bitmap count, both builds | Decoded-pixel estimate, both builds | Original max completed Blob queue + decode inputs | Integrated max completed Blob queue + decode inputs |
|---|---:|---:|---:|---:|
| Desktop | 72 | 149,299,200 B / 142.4 MiB | 155,814 B | 748,290 B / 0.714 MiB |
| Mobile | 60 | 69,984,000 B / 66.7 MiB | 105,234 B | 497,804 B / 0.475 MiB |

Integrated waiting-queue peaks were eight frames, 592,476 B desktop and 392,570 B mobile. No extra bitmap cache or profile was created. Existing 160/80 MiB normal decoded ceilings and device-aware reductions remain. A simulated 2 GB device fetched zero frames. The completed-Blob overhead increased as expected from independent scheduling, without increasing retained decoded pixels.

All 20 warm teardown assertions in the timed comparison completed with zero tracked live bitmap bytes; the candidate accounts for ten of those. Cleanup waits for observable disposal with a five-second bound. No fixed 30 ms disposal deadline remains in the benchmark runner. The separate StrictMode test released both held late decodes and confirmed zero live bitmaps/cache afterward.

## E. Before-and-after measurements

### Method and provenance

Collection: **13 October 2026, 08:12–08:19 IST**. Apple M2, 8 logical CPUs, 8 GiB RAM, Darwin 25.5.0 arm64, Node v26.7.0, headless Chrome **155.0.8059.40** through the existing Playwright installation. No dependencies were installed.

Desktop viewport 1440×900, DPR 1; mobile 375×812, DPR 2 with mobile/touch emulation. Both builds used the same local HTTP/1.1 server, gzip startup resources, original public asset bytes/paths, ETags, and existing `max-age=0, must-revalidate` policy. Throttle: **200,000 B/s down, 100,000 B/s up, 100 ms latency, CPU rate 4**.

Each cold run used a fresh browser context and `Network.clearBrowserCache`, followed by a warm reload in the same context. Five cold/warm pairs per build/profile give 40 navigations. Build order rotated by round/profile. Collection was serial, after all other browser suites finished. No concurrent benchmark ran. Cold browser cache does not mean cold OS cache or cold CDN; this server has no CDN.

Baseline source comes from Git revision `f4aaf02e20d72fa0bad3a1bb6e7a656e71ec8d65`. The three original loader/transport/hook source hashes match the previous benchmark inventory. The rebuilt instrumented baseline JS is **byte-for-byte identical** to the previous baseline: `index-DZ2fz6zQ.js`, SHA-256 `869de43d96bd487489cfc5abf4eb7c2b680b759d2a82247497dc5747b0c7c4ef`.

The integrated candidate uses the current production source and normal Vite configuration. Audit-only callbacks observe preparation, completed bodies, cache insertions, and failed attempts. No experimental loader replaces production, no concurrency limit is transformed for the candidate, and no benchmark query is interpreted by the shipping application. The normal production bundle contains no benchmark callbacks. SHA-256 inventory confirms the tested candidate source did not change during collection or before this report.

### Readiness distribution

Times below are **milliseconds from navigation start**. Canvas readiness follows complete retention and the first successful draw. Every row has five successful cold and five successful warm trials. Empirical nearest-rank p95 with five samples equals the slowest observation; it is not a population-tail estimate. SD is descriptive with denominator n.

| Device/build | Cold median | Cold p95 / slowest | Cold fastest | Cold SD | Warm median | Warm p95 | Peak downloads / decodes | Preparation failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Desktop original 2/2 | 19392.9 | 19563.8 | 19163.8 | 131.9 | 1238.0 | 1553.0 | 2 / 2 | 0/10 |
| Desktop integrated 4/2 | 16422.9 | 16664.0 | 16319.1 | 128.7 | 1094.3 | 1323.7 | 4 / 2 | 0/10 |
| Mobile original 2/2 | 13077.2 | 13381.9 | 12562.0 | 311.9 | 1072.4 | 1110.2 | 2 / 2 | 0/10 |
| Mobile integrated 4/2 | 10611.8 | 10654.1 | 10554.5 | 38.7 | 985.7 | 1209.6 | 4 / 2 | 0/10 |

Cold reductions are 15.3% desktop / 18.9% mobile. Warm medians improve 11.6% / 8.1%, but mobile warm sample p95 is worse, 1110.2→1209.6 ms. The small sample does not establish universally faster warm tails; all observations, including outliers, are retained.

### Pipeline milestones

Each value is an independently calculated median, in navigation-relative milliseconds. Decode completion and final cache insertion agree at this precision. Reveal begins when preparation completes; overlay disappearance includes the existing fade.

| Device/build/cache | All downloaded | All decoded | All retained | Canvas ready | Reveal begins | Loading screen gone |
|---|---:|---:|---:|---:|---:|---:|
| Desktop original cold | 19368.2 | 19377.7 | 19377.7 | 19392.9 | 19400.6 | 19576.0 |
| Desktop integrated cold | 16397.7 | 16406.3 | 16406.3 | 16422.9 | 16432.0 | 16620.7 |
| Desktop original warm | 1214.6 | 1222.9 | 1222.9 | 1238.0 | 1244.3 | 1423.3 |
| Desktop integrated warm | 1055.0 | 1090.7 | 1090.7 | 1094.3 | 1101.1 | 1277.5 |
| Mobile original cold | 13038.3 | 13049.8 | 13049.8 | 13077.2 | 13098.0 | 13277.4 |
| Mobile integrated cold | 10600.2 | 10606.6 | 10606.6 | 10611.8 | 10622.0 | 10796.3 |
| Mobile original warm | 1064.6 | 1070.4 | 1070.4 | 1072.4 | 1075.4 | 1255.9 |
| Mobile integrated warm | 944.4 | 969.9 | 969.9 | 985.7 | 991.0 | 1171.3 |

Network delivery remains dominant under this throttle. Median first-frame download completes later with four shared-bandwidth requests: 2665.6→3435.3 ms desktop / 2530.0→2979.3 ms mobile. Complete-sequence readiness improves substantially, which is the required reveal criterion. Manifest durations remain roughly 132–137 ms.

### Comparison with the prior isolated 4/2 experiment

| Profile | Previous isolated cold median | Integrated cold median | Difference | Previous isolated warm median | Integrated warm median |
|---|---:|---:|---:|---:|---:|
| Desktop | 16348.4 ms | 16422.9 ms | +74.5 ms / +0.46% | 986.8 ms | 1094.3 ms |
| Mobile | 10597.0 ms | 10611.8 ms | +14.8 ms / +0.14% | 864.5 ms | 985.7 ms |

Cold results reproduce the isolated architecture's performance closely. Warm medians are higher across sessions, but original baseline warm medians also rose from 1111.3→1238.0 ms desktop and 964.1→1072.4 ms mobile. The earlier session used Chrome 155.0.8059.39, versus .40 now. Host/runtime variation and the small samples prevent attributing those cross-session warm differences solely to integration. No special candidate-only optimization was added to recover a benchmark number.

### Transfer and scheduling

| Profile | Startup request events cold / warm, both builds | Original total transfer cold / warm | Integrated total transfer cold / warm | Unchanged sequence body bytes | Warm frame transfer |
|---|---:|---:|---:|---:|---:|
| Desktop | 80 / 83 | 3,049,827 / 3,001 B | 3,050,475 / 3,001 B | 2,770,034 B | 0 B |
| Mobile | 68 / 70 | 1,903,748 / 2,714 B | 1,904,396 / 2,714 B | 1,627,620 B | 0 B |

Counts are browser request events, including cache hits, not all network transfers. Warm pages can initiate additional previously exposed non-frame resources. Frame calls and decode calls remain exactly 72/60 for both cache states. Every cold frame missed browser HTTP cache, every warm frame hit it, and every warm sequence was decoded again. No decoded cache persists across reloads. Candidate cold startup transfer increases only 648 B in the instrumented comparison bundles.

Normal shipping JS changed from 388.82 kB / 123.59 kB gzip to 390.90 kB / 124.26 kB gzip, approximately +0.67 kB gzip. CSS remains the same `index-DGeYixNh.css`. No dependency, image, or manifest changes contribute to the improvement.

| Cold profile/build | Average active fetches | Average active decodes | Median per-frame download queue wait | Median per-frame decode queue wait | Download/decode overlap |
|---|---:|---:|---:|---:|---:|
| Desktop original | 1.948 | 0.044 | 11231.6 ms | 0.2 ms | 630.2 ms |
| Desktop integrated | 3.956 | 0.063 | 9431.4 ms | 0.1 ms | 800.0 ms |
| Mobile original | 1.932 | 0.053 | 7017.8 ms | 0.2 ms | 499.3 ms |
| Mobile integrated | 3.944 | 0.076 | 5682.2 ms | 0.1 ms | 610.1 ms |

Averages integrate actual fetch-to-Blob/decode-promise spans over the first-fetch-to-Canvas interval. Resource Timing independently confirms cold network-span peaks of two versus four. These are not counts of queued promises. Summed overlapping decode latency is retained in JSON but is not treated as elapsed decoding time or CPU utilization.

### Responsiveness and recorded variability

All 40 forward/reverse traversals, rapid jumps, expected-frame checks, adjacent blends, nonblank pixel samples, and four storytelling-stage checks passed. Additional frame downloads/decodes during prepared scrolling: **zero**. No idle repaint loop or traversal long task was observed.

Traversal rAF p95 was 16.7 ms in both desktop builds and 16.8→16.7 ms on mobile. Desktop maximum intervals were 49.9 ms original / 50.0 ms integrated; mobile maxima were 16.8 ms in both. This supports preserved scrolling behavior in the measured environment, not a guarantee of a flawless frame cadence on every device.

Startup was not uniformly free of long tasks. Desktop original cold runs each had three; the candidate had three in four runs and four in one. The largest desktop task was 91 ms original / 138 ms candidate. Mobile original had three in four runs and four in one; candidate had three in each, with maxima 276 ms / 160 ms respectively. Each mobile build had one warm run with one long task (64 ms original / 57 ms candidate); desktop warm runs had none. These variable observations are retained; no general startup CPU improvement is claimed. A fully attributed CPU trace was not collected.

Browser console/page errors and timed-run network failures were zero. The Canvas readback warning is produced by post-startup pixel validation and does not justify changing production rendering settings.

## F. Functional verification

| Check | Result |
|---|---|
| TypeScript | Project and retained benchmark TypeScript checks passed. |
| Lint | `npm run lint` passed using the repository's existing **Oxlint** configuration; ESLint is not installed/configured and was not added. |
| Production build | `npm run build` passed; ordinary shipping bundle has no benchmark instrumentation. |
| Project unit suite | **36/36 passed**, including 12 new loader tests and six new transport tests. |
| Existing experimental unit suite | **6/6 passed**. |
| Chromium regression suites | All **19 distinct suites passed** after the URL correction; 18 passed in the initial invocation, followed by a 4/4 targeted recheck covering the corrected suite and final loader/failure paths. |
| Firefox | **3/3 passed**: preparation, profile isolation, blending. |
| Playwright WebKit | **3/3 passed**: preparation, profile isolation, blending. This is not a manual Safari session. |
| Targeted fault/lifecycle browser checks | **28/28 passed**: 14 scenarios each for baseline and integrated source. |
| Development StrictMode | Passed setup/cleanup/setup with two manifest attempts and two deliberately held native decodes; no stale reveal or retained bitmap after cleanup. |
| Timed integration comparison | **40/40 passed**, no failures/retries/timeouts, with all 20 condition-based warm teardown checks passing. |
| Preliminary normal-network smoke | **8/8 passed**; preliminary timings are not used as the acceptance comparison. |
| Mobile soak | Passed approximately 122 seconds, 40 seeks, orientation changes, exact 60-frame retention, idle rendering, and teardown. |

The focused cases cover maximum operation counts, download admission while both decoders are held, out-of-order bodies, bounded backpressure, shared requests, corrupt/oversized/wrong-dimension responses, missing/understated size headers, retry exhaustion, downloading/native-decoding cancellation, late-result disposal, windowed eviction/pinning/reconfiguration, HTMLImage fallback, per-job deadlines, and unchanged memory policy.

The browser gate test withheld the final desktop frame while 71 were decoded: the loading screen remained and Canvas readiness was false. Only releasing the final frame allowed complete retention, Canvas draw, and reveal. Other scenarios exercised low memory, reduced motion, Save-Data, explicit bypass/direct anchors, visibility, pagehide/pageshow, failed frames, and the 45-second deadline. Existing suites verified opening-text coordination, navigation, properties, forms/dialogs, keyboard focus, and responsive layout. Ready desktop/mobile screenshots were inspected.

The initial Chromium invocation recorded one genuine **test-routing failure**, not an application exception: a responsive manifest URL was assembled from a bare `:5173` origin and escaped the runner's trailing-slash URL replacement. The assertion was preserved, the URL construction corrected, and the suite passed against the production preview. Its original failure report remains available. The prior benchmark's 30 ms cleanup failures were not reproduced with condition-based checks; no failure was suppressed by removing a cleanup assertion.

### Evidence and reproduction

Main ignored artifact directory: `artifacts/frame-concurrency/integration-main-01/`.

- [All 40 observations](../artifacts/frame-concurrency/integration-main-01/results.json), [per-navigation raw evidence](../artifacts/frame-concurrency/integration-main-01/raw/), and [summary](../artifacts/frame-concurrency/integration-main-01/summary.json).
- [Environment](../artifacts/frame-concurrency/integration-main-01/environment.json), [build provenance](../artifacts/frame-concurrency/integration-main-01/build-provenance.json), [source inventory](../artifacts/frame-concurrency/integration-main-01/source-inventory.json), and [unchanged-during-collection verification](../artifacts/frame-concurrency/integration-main-01/integrity.json). The `productionUnchanged` flag describes the collection interval, not the authorized changes relative to Git HEAD.
- [28 fault/lifecycle results](../artifacts/frame-concurrency/integration-validation/verification.json) and [StrictMode results](../artifacts/frame-concurrency/integration-validation/strictmode.json).
- [Initial Chromium report](../artifacts/hero-optimization/integration-chromium.json), [Chromium recheck](../artifacts/hero-optimization/integration-chromium-recheck.json), [Firefox](../artifacts/hero-optimization/integration-firefox.json), and [WebKit](../artifacts/hero-optimization/integration-webkit.json).
- [Desktop screenshot](../artifacts/full-frame-preloader/ready-1440-cold.png) and [mobile screenshot](../artifacts/full-frame-preloader/ready-375-cold.png).

Run from the repository root, with existing dependencies and installed Chrome:

```sh
npm run typecheck
npm run lint
npm test
npm run build
./node_modules/.bin/tsc -p scripts/frame-concurrency/tsconfig.json --noEmit
node --test scripts/frame-concurrency/loader.test.mjs
node scripts/frame-concurrency/run.mjs --output artifacts/frame-concurrency/integration-reproduction-01 --trials 5 --networks throttled --integration
node scripts/frame-concurrency/summarize.mjs artifacts/frame-concurrency/integration-reproduction-01
node scripts/frame-concurrency/verify.mjs artifacts/frame-concurrency/integration-reproduction-01
node scripts/frame-concurrency/verify-strictmode.mjs artifacts/frame-concurrency/integration-reproduction-01
```

Use a new output directory for each timing run; the runner refuses to overwrite results. The pinned baseline Git revision must be present. `PLAYWRIGHT_PATH` can point to an already installed Playwright package; this machine used the existing global playwright-cli dependency. Serve `dist` with `npm run preview -- --host 127.0.0.1 --port 4173` to repeat existing suites through `scripts/run-browser-suites.mjs`, setting `SUITE_URL=http://127.0.0.1:4173/` and a new `SUITE_REPORT` name. Run browser suites separately from performance collection.

The performance and Playwright skills guided validation. Context7 was verified operational and used to check current React StrictMode/effect-cleanup behavior; the production implementation and tests remain authoritative for this repository. No external communications or deployment tools were used.

## G. Remaining limitations

Physical Android/iPhone memory-pressure behavior and manual Safari remain unverified. Playwright WebKit coverage is useful but does not model a physical iPhone's decoder, GPU, thermal behavior, or OS limits. The unchanged full bitmap cache remains the main memory cost; width×height×4 is not process RSS or a free-memory measurement.

This is a five-pair-per-cell, single-host, local HTTP/1.1 experiment. It does not predict exact Vercel HTTP/2/HTTP/3 timings, CDN coldness, radio behavior, rare failures, field INP, or population p95. The live deployment was not changed or used as a candidate in this task. The measured improvement does not guarantee that every historical 45-second visit is eliminated; the safety fallback remains important.

The streamed 256 KiB response cap is intentional and tested. A future asset regeneration exceeding it needs policy review. The existing visual sampling, image compression, occasional blend ghosting, source watermark, and media-rights limitations are unchanged.

## H. Deployment readiness

**Local integration is complete and ready for manual review.** Automated acceptance passes: four actual downloads, at most two decodes, full retention before reveal, bounded compressed payloads, unchanged decoded memory, no duplicate prepared work, preserved scrolling, and measured cold-load improvement over the original source.

There are no unresolved critical test failures. Physical-device/manual Safari checks remain a recommended pre-release validation step; the small sample and startup/warm-tail variability above should remain visible in review. Deploy only after the user's separate release decision. Nothing has been committed, pushed, or deployed.
