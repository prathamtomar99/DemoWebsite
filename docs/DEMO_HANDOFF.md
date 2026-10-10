# Aether Estates — Client demonstration handoff

Batch 7, verified 2026-10-10. Aether Estates is a fictional luxury real-estate presentation, built with Vite, React, TypeScript, Tailwind, Motion and Lucide. This handoff prepares a local client demonstration; it does not authorize publication or real enquiry collection.

## Start the demonstration

Use the existing Node/npm setup. On a fresh checkout, run `npm ci` once before the meeting; do not reinstall dependencies during the presentation.

```bash
cd "/Users/prathamtomar/Desktop/Pratham/Freelancing/Website/Construction"
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open **http://127.0.0.1:4173/** in Chrome. Leave the terminal running; Ctrl+C stops it. If port 4173 is already serving this project, use that running preview or stop that process before restarting. Do not open `dist/index.html` directly. For editing use `npm run dev`; use the production preview for the client meeting. Vite preview is a local inspection server, not a production hosting service.

Before the meeting, rehearse the complete journey once in the intended browser/window, then return Home. Close unnecessary background workloads and notifications yourself, connect power, and keep the preview running. Rehearsal lets normal browser caching help subsequent visits; it does not preload all frames or enlarge the bounded decoded cache. All runtime imagery/fonts are local, so the running preview does not need third-party image services. Respect reduced-motion and Save-Data preferences; those intentionally show a static opening.

## Recommended three-minute presentation

1. **Opening:** pause on the exterior composition and “Beyond the expected.” Explain that this is an architectural discovery concept.
2. **Cinematic journey:** scroll steadily through the four story stages. Pause to show that the camera stops with the scroll; reverse a short distance to demonstrate bidirectional control. Let the final headline remain visible.
3. **Collection:** use “Explore Our Collection” to reach the three residences directly. Point out that each is a fictional concept, not a verified listing.
4. **Residence detail:** open The Horizon House. Show the expanded story, photography credit, responsive presentation and Escape/close control.
5. **Viewing simulation:** select “Request a Viewing.” Show the preselected residence and visible demo disclosure. Use only invented test information, such as `Demo Visitor` and `demo@example.com`, and a future preferred date. Submit to show **“Demo complete. No viewing request has been sent.”**
6. **Editorial finish:** visit About, the proposed services, closing CTA and footer. Return Home. If useful, briefly show the mobile layout and menu.

Use “Skip the film” or Properties whenever the client wants to bypass the cinematic scroll distance. Do not suggest that an appointment was booked or that the sample agency represents the photographed homes.

## Features preserved

- Original supplied footage, 240 frames, deterministic forward/reverse Canvas playback and the existing approximately 500vh sticky experience.
- Four synchronized text stages, initial entrance, focused-CTA safeguards, normal sticky release and working section destinations.
- Priority loading and unchanged decoded cache capacities: 18 desktop / 6 mobile. Poster and media-failure fallbacks; static reduced-motion/Save-Data modes with no sequence requests.
- Three disclosed property concepts, accessible details and viewing dialogs, local validation, keyboard navigation and focus restoration.
- Responsive navigation, agency philosophy, proposed services, closing invitation and footer.

No runtime component, visual token, timeline, source video or frame asset was changed in Batch 7. No new visual defect or reproducible performance regression justified changing the approved implementation. The work adds repeatable audit/capture tooling and presentation materials, rather than claiming an unmeasured optimization.

## Screenshots and walkthrough

- [Local evidence gallery](../artifacts/batch7/gallery.html)
- [Desktop full page](../artifacts/batch7/1440-full.png) / [mobile full page](../artifacts/batch7/375-full.png)
- [Desktop opening](../artifacts/batch7/1440-hero-0.png) / [mobile opening](../artifacts/batch7/375-hero-0.png)
- [Collection](../artifacts/batch7/1440-properties.png) / [tablet collection](../artifacts/batch7/768-properties.png)
- [Property details](../artifacts/batch7/1440-details.png) / [viewing form](../artifacts/batch7/375-form.png)
- [Agency](../artifacts/batch7/768-about.png) / [mobile closing](../artifacts/batch7/375-contact.png)
- [18.2-second local walkthrough](../artifacts/batch7/client-walkthrough.webm), approximately 1.5 MB: forward/reverse film, collection, property details and local demo completion.

The gallery includes all four hero compositions and each section at desktop 1440×900, tablet 768×1024 and mobile 375×812. Screenshots were inspected for framing, text placement, imagery, spacing, navigation and dialog composition. Full-page screenshots include the tall pinned-scroll travel area; individual viewport captures and the recording better represent the live cinematic experience. The evidence is local and ignored by Git, not shipped in the application bundle.

## Mobile performance consistency

Ten production Lighthouse 13.5.0 runs were executed sequentially: **five independent cold/warm pairs**. One fresh headless Chrome process/profile per pair; cold run resets storage/cache, then warm run uses the same process/profile with `disableStorageReset: true`. No other automated browser suites or builds ran during measurement. Existing user applications were left untouched. This is controlled local testing, not a dedicated laboratory or a physical-phone benchmark.

Fixed settings: mobile 412×823, DPR 1.75, simulated throttling, 150 ms RTT, 1638.4 Kbit/s throughput and 4× CPU slowdown. Same production URL/build, machine, browser and Lighthouse version throughout. Every full result, resolved setting set, timestamp, load-average sample, LCP breakdown, trace summary and cache evidence is retained in `artifacts/batch7/`. Warm runs retain browser caches, including compiled/decoded resource state where the browser chooses; the comparison is not a pure network-only experiment.

| Pair | Cache | Performance | FCP (s) | LCP (s) | TBT (ms) | Transferred bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | cold | 95 | 1.707 | 2.854 | 13.0 | 887041 |
| 1 | warm | 100 | 0.911 | 1.202 | 7.0 | 1097 |
| 2 | cold | 94 | 1.658 | 3.008 | 3.0 | 887041 |
| 2 | warm | 100 | 0.911 | 1.202 | 5.0 | 1097 |
| 3 | cold | 95 | 1.653 | 2.853 | 3.0 | 887041 |
| 3 | warm | 100 | 0.903 | 1.053 | 6.2 | 1097 |
| 4 | cold | 94 | 1.655 | 3.005 | 3.0 | 887041 |
| 4 | warm | 100 | 0.904 | 1.204 | 12.7 | 1097 |
| 5 | cold | 94 | 1.654 | 3.004 | 9.0 | 887041 |
| 5 | warm | 100 | 0.912 | 1.203 | 6.0 | 1097 |
Cold score median **94**, range **94–95**; warm median/range **100**. Cold median LCP **3.004 s**, warm median **1.202 s**. CLS was at most **0.000108**. Every run scored Accessibility **100**, Best Practices **100**, SEO **66**; noindex remains intentional. Cold LCP still exceeds the product's 2.5 s target. Warm results do not replace cold-start performance requirements. TBT is not INP; no field Core Web Vitals are claimed.

### What the investigation established

- **LCP:** `.hero-poster` was the LCP element throughout. Its preload/high priority works. Raw trace breakdowns showed cold resource discovery delay around 5.7–13.2 ms, load duration 6.3–11.9 ms, and render delay 77–102 ms. Warm render delay was 68–88 ms. These are unthrottled trace observations used by Lighthouse's simulation; they do **not** sum to its simulated 3-second LCP.
- **JavaScript/main thread:** cold script evaluation in the Lighthouse work breakdown ranged approximately 191–284 ms; cold TBT was only 3–13 ms. The previous 480–530 ms blocking outlier did not recur. Warm TBT was 5–12.7 ms. The application still pays startup/rendering costs, but these measurements do not demonstrate a new long-task defect.
- **Decoding/Canvas:** four JPEG decode events per run (poster plus initial frames); individual raw decode events stayed below 5.4 ms. Canvas initialization did not trigger an all-frame fetch. Only frames 1–3 plus the manifest were requested initially; existing bounded loading and cleanup tests still pass.
- **Fonts:** two local WOFF2 files, approximately 23.6/24.9 kB transferred on cold visits, with swap behavior. Display font is preloaded, body font discovered through CSS. No remote font service or recurring font request storm appeared.
- **Network/cache:** cold transfer was approximately 866 KiB, including the poster and three nearby frames. Warm audit transfer was 1,097 bytes with cached/validated resources; all three frame responses were confirmed from disk cache. This measures transferred data, not total decoded memory. Preview's revalidation policy and existing ETags were preserved.
- **Environment:** one-minute system load before runs ranged about 1.96–2.93. The same code produced stable results when audits ran sequentially and cache policy was explicit. This supports local test conditions as a contributor to Batch 6's spread; it does not retrospectively prove which background workload caused the 64-point result. Both cold application startup cost and environmental/simulation variation matter. No deliberate load injection or user-process shutdown was performed.

The demonstrated improvement is **measurement repeatability**, not a claimed runtime speedup from a code patch. Keeping the known-good cinematic loader is preferable to making an unsupported change based on the old outlier. Target-device and hosted measurements remain necessary.

### Repeat the audit

`scripts/audit-demo.mjs` uses an existing external Lighthouse/chrome-launcher installation. No dependency was added to the project. On this workstation the tooling was already in npm's cache:

```bash
LIGHTHOUSE_TOOLS_ROOT=/Users/prathamtomar/.npm/_npx/0f94ee7615faf582/node_modules \
  node scripts/audit-demo.mjs artifacts/batch7-repeat
```

Keep the production preview at 4173 running, avoid concurrent browser tests/builds, and use a new output directory. That cache path is machine-specific; point the environment variable at an available installation containing both packages on another machine. Preserve individual results instead of reporting only the best score. See [raw measurements](../artifacts/batch7/measurements.json).

## Validation and change scope

Batch 7 files: `scripts/audit-demo.mjs`, `tests/demo-browser.js`, this handoff, README link, and local evidence. No dependencies, application components, specifications or media were changed. Runtime bundle baseline is 120.71 kB gzipped JavaScript and 6.48 kB gzipped CSS; final build comparison is recorded below.

TypeScript, lint, production build and all **7 unit tests** passed. All **8 original browser suites** passed without weakened assertions: core, accessibility, resilience, touch, story, story-edge, website interaction and website accessibility. The existing production compatibility and keyboard-only suites were also rerun; final outcomes are recorded below. `tests/demo-browser.js` additionally captured the three representative layouts with no runtime errors or horizontal overflow.

For existing tests, keep the dev server at 5173 and use fresh Playwright sessions to isolate preferences, routes and focus. Production tests and the demo capture use 4173. See README and [FINAL_QA.md](FINAL_QA.md) for commands and detailed coverage.

## Honest presentation and publication requirements

The viewing form validates entirely in the browser. It sends no email/API/webhook request, stores no personal data, clears entered values on completion/close, and makes no booking. Keep its visible demo disclosure. Never enter actual client personal information for a presentation.

Woodland, Horizon and Courtyard are fictional concepts. Their independent illustrative photographs do not prove listing ownership, agency representation, price, availability or appointment access. Source credits and licensing notes remain in [IMAGE_SOURCES.md](IMAGE_SOURCES.md). No imagery or rights claims were changed here.

The supplied drone footage still carries its visible Gemini watermark. Neither it nor the source-derived media has been modified or concealed. Commercial use requires confirmation of the source's rights/branding conditions and a properly licensed clean export if needed; the configurable pipeline supports replacement later.

Before commercial publication:

1. Approve the actual client identity, business details, contact destinations and genuine property inventory/media rights.
2. Resolve the drone source's licensing/branding conditions and recheck replacement footage if supplied.
3. Validate on actual Safari, physical phones/mobile keyboards, a screen reader, and real 200%/400% browser zoom. Playwright WebKit does not replace Safari; viewport emulation does not replace those checks.
4. Select and authorize a real domain/hosting setup, review caching/security, and measure cold performance on target devices and that deployment. Mobile cold LCP remains an improvement opportunity.
5. Separately authorize a privacy-compliant delivery mechanism if real enquiries are required. The current form must remain a clearly labelled simulation until then.
6. Configure genuine canonical/sharing destinations and review indexing only after the real site is approved. Keep `noindex` and the crawler prohibition for this concept.

Ready for a local premium client demonstration within the verified scope. No deployment, backend, paid service, new video, or subsequent batch is included.
