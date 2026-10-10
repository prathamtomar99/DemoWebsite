# Batch 4 — Cinematic storytelling

Batch 4 adds the four text stages only. The existing preview section is retained; no listings, enquiry forms, dialogs, new page sections, or new media have been created. Batch 5 awaits approval.

## Files and architecture

- `src/components/hero/HeroStory.tsx`: reusable `StoryPanel` presentation, semantic headings, nested mount animation, scroll transforms, accessibility subscriptions, and shared focused-panel hold.
- `src/config/hero-story.ts`: configurable copy, alignment, CTA labels/destinations, visibility ranges, opening entrance durations/delays/travel/easing. Brand labels derive from `siteConfig.brandName`.
- `src/components/hero/story-timeline.ts`: pure smoothstep timeline for opacity and travel. Reversible, deterministic, clamped, no time integration.
- `ScrollHero.tsx`: integrates the story with its existing `progress` MotionValue. Exactly one h1; decorative canvas and architectural description retained.
- `use-hero-sequence.ts`: one narrowly scoped change publishes existing progress before the manifest/loader guard, so stalled loading cannot freeze the overlays. No new progress measurement, scroll listener, cache behavior, renderer, or permanent loop.
- `src/styles/hero.css`: replaces the static introduction styles with the responsive four-stage composition and approved typography/color tokens.
- `src/config/site.ts`: obsolete initial heading removed; identity and media paths remain configured here.
- `tests/hero-story.test.mjs`, `hero-story-browser.js`, `hero-story-edge-browser.js`: new pure timeline and actual browser coverage. Existing Batch 3 test files are unchanged.

The installed Motion 14 package exports `motion/react`; no dependencies were added. `useTransform` derives styles directly from the existing frame progress. React state changes once when the intro entrance completes, not per scroll pixel. Accessibility DOM attributes change only at visibility/interaction boundaries, and subscriptions clean up on unmount. Canvas DOM identity remains stable.

The opening eyebrow, heading, support, and CTA animate on mount in separate nested layers. The panel's outer transform/opacity handles its scroll exit independently. A fast scroll away during entrance does not replay or strand the entrance when returning. Later panels never use time-based sequencing or springs.

## Timeline

| Stage | Enter | Hold | Exit |
| --- | --- | --- | --- |
| Opening identity | Mount: prescribed stagger, easing [.16, 1, .3, 1] | 0–.04 | .04–.14 |
| Right narrative | .18–.24 | .24–.43 | .43–.50 |
| Left narrative | .54–.61 | .61–.80 | .80–.87 |
| Centered finale | .88–.96 | .96–1, through sticky release | None |

`BRIEF.md` received a targeted correction replacing its initial proposed copy/actions with the explicit Batch 4 copy and temporary collection destination. `MOTION_REFERENCE.md` received a targeted correction because its older windows and no-mount-delay rule directly contradicted Batch 4. `DESIGN.md` is unchanged. Specification responsibilities remain separate.

## Composition and accessibility

Representative existing frames 1, 61, 121, 156, 228, and 240 informed placement. Desktop side panels leave the doorway and central interior axis available; the finale sits above the principal seating arrangement. Local scrims support contrast without covering the lower-right watermark. Portrait opening identity sits above the intact film, with supporting copy and CTA below; subsequent narratives sit below the image. Typography and travel reduce for compact viewports. No image cropping or video processing changed.

Both real anchor CTAs point to `#after-hero`, the existing labeled development preview. Activation bypasses the cinematic travel and moves focus to that section. Hidden panels are inert and aria-hidden. Near-transparent/unfinished mount CTAs are removed from tab order and pointer interaction. The single opening h1, subsequent h2 elements, paragraphs, links, and visible focus styles are real DOM content.

If a CTA remains focused while scrolling, its panel stays visible and the other panels are suppressed until focus leaves. This is the intentional accessibility exception to the visual timeline. If a live reduced-motion/Save-Data switch forces a focused panel to disappear, focus goes to the persistent visible Continue link before the panel becomes inert. Ordinary scrolling does not move focus.

Static modes retain the short poster hero and a fully visible opening identity with working CTA; no stagger or sequence requests. The extra narrative lines convey atmosphere, not essential exclusive information. Native scrolling and sticky release remain unchanged.

## Executed checks

All tests used the local app in Chromium through Playwright CLI.

- TypeScript, lint (zero warnings), and production build passed.
- Five Node tests passed: three unchanged Batch 3 cases plus two timeline tests covering endpoints, gaps, reversal, clamping, persistent finale, and no overlap across 1,001 sampled positions.
- All four unchanged browser suites passed: core, accessibility, resilience, and emulated touch.
- Both new storytelling browser suites passed: hard reload entrance, mount interruption/recovery, all stage windows, gaps, reverse/jump behavior, 100% persistence, CTA click and keyboard destinations, hidden tab-order exclusion, focus retention, live preference focus recovery, and text progress during delayed manifest loading.
- Desktop 1440×900, tablet 768×1024, mobile 375×812; additional 320×568, 390×664, 720×450, 1440×720 checks found no text clipping or horizontal overflow.
- Source-frame mapping, last-valid-image fallback, poster, missing frame retry, invalid manifest, corrupt JPEG fallback, total media failure, cache bounds, resize/orientation, offscreen suspension, and bitmap cleanup passed.
- Reduced motion and Save-Data made zero sequence requests. Emulated iPhone touch swipe advanced to frame 37; skip/back links worked, DPR remained capped at 2.
- Story suite recorded no console warnings or runtime errors. Failure-injection suites intentionally produce expected network failures.
- Instrumented resilience sample: 18 resident desktop bitmaps, transient peak 19, at most four requests, no stale paints, CLS approximately 0.000046. Idle canvas paint count remained stable. This is a local sample, not a field metric.
- Build JS: 361.70 kB / 115.48 kB gzip. CSS: 14.70 kB / 4.28 kB gzip. Motion presentation adds about 39 kB gzipped JS relative to Batch 3; no additional library or frame assets.
- Source SHA-256 remains `279e8283475539b00d22fd6805f45f2b78be19aeb85e626e119b3d35555e9320`.

Local evidence: `artifacts/story-browser-results.txt`, `story-edge-results.txt`, and `browser-{core,accessibility,resilience,touch}-results.txt`. Screenshots `story-{1440,768,375}-{0,25,65,95}.png` cover the requested progress positions. Artifacts are ignored local files; test scripts are retained in the project.

The first test run exposed an overly strict floating-point equality assertion and a delayed Playwright route left active by a failed test. These harness issues were corrected and rerun. The live preference focus test exposed a real focus-loss edge case; it was fixed and its regression now passes.

## Remaining limits

No known defect remains in the tested scope. Physical-device, Safari/WebKit, assistive-technology sessions, Lighthouse scores, field LCP/INP, and sustained low-end-device frame-rate measurements were not performed. Readability was visually reviewed at sampled frames; this is not a full frame-by-frame contrast certification. Portrait layouts deliberately retain letterboxing to show the full source architecture and watermark. Cold cache misses may briefly retain an earlier valid frame while text follows current progress, as required by the existing loader contract.

The Gemini watermark is still visible and unchanged. No clean licensed replacement was supplied. Publishing SEO and the property collection remain later-batch work; the concept site keeps its existing noindex setting. Ready for Batch 5 subject to user approval.
