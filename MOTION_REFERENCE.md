# Aether Estates — Motion and Video Specification

## Authority

This document owns HOW things move: scroll mapping, video-frame rendering, transitions, loading, and motion alternatives. `BRIEF.md` owns product content and interactions; `DESIGN.md` owns colors, typography, and spatial composition. Explicit user instructions take precedence, then the owner of each subject.

## Source and current inspection status

Use only `assets/source/DroneVideo.mp4`, the supplied exterior-to-interior drone shot. The footage is the single source of truth for architectural movement; do not synthesize camera movement or invent extra scenes. Batch 2 inspection with ffprobe verified H.264 video at 1280 × 720, constant 24 FPS, 240 decoded source frames, and a 10.000000-second video stream. The container lasts 10.026667 seconds and includes stereo AAC audio; audio is not included in the image assets. No rotation metadata is present. Width/height gives a 16:9 raster; source SAR/DAR tags are unspecified. The original source remains unchanged, verified by SHA-256.

The source contains a visible Gemini watermark. It remains an existing source limitation and has not been removed. Preserve the master. A future properly licensed clean export must be replaceable through source configuration and regenerated media manifests, without changing renderer code. Do not hide the watermark via frame processing or render cropping.

## Scroll-controlled cinematic stage

Use the existing **350svh** section height on desktop and mobile, configured by the single `--hero-scroll-height` token in `src/styles/tokens.css`. This is the actual setting verified at the start of the cinematic-preloader task; the earlier 400svh prose was stale. The preloader does not change this token or scroll speed. Small viewport units preserve mobile toolbar stability. Its viewport-height child stays pinned using native CSS `position: sticky; top: 0`; active distance is section height minus pinned viewport height (2.5 viewport heights). Keep native wheel, touch, scrollbar, keyboard, and anchor scrolling. The next section stays in normal flow. Static reduced-motion/Save-Data modes retain automatic section height.

Render source-derived frames into a canvas. The source video must not autoplay, play on a clock, or provide a parallel playback timeline. Batch 2 prepares assets only. `npm run prepare:hero` generates the verified source sequence; Batch 3 will implement rendering only after user approval. Always read the actual manifest rather than hardcoding the current frame count.

For section document top `S`, section height `H`, pinned viewport height `V`, and document scroll offset `Y`:

```
p = clamp((Y - S) / max(1, H - V), 0, 1)
frameIndex = min(N - 1, floor(p * (N - 1) + 0.5))
```

`N` is the manifest's actual frame count (at least one). At p=0 display frame 0; at p=1 display N-1. The same progress must select the same frame in either direction. Moving upward reverses the shot. Coalesce drawing into requestAnimationFrame; avoid React state updates for every scroll event. Do not spring-smooth or time-integrate the frame index: that would introduce lag and history dependence. Recalculate geometry on resize/orientation and synchronize restored/deep-linked scroll positions.

### Scroll-fraction blending refinement

The smooth-frame-transition request extends visual rendering without changing the nearest-frame request index above or the story timeline. When enabled, calculate `position = p * (N - 1)`, with `floor(position)` and its next adjacent index. Blend those cached images using a configurable scroll-fraction curve; never blend nonadjacent frames or advance alpha on a clock. Outside the blend window draw a single sharp frame. If only one pair member is available, draw it; otherwise retain the previous surface/poster. First and last positions remain exact endpoint images. Reevaluate late loads against current progress, and freeze when progress and available images are unchanged. Resource-profile enable flags allow disabling this refinement independently. Implementation, final window selection, visual tradeoffs, and measurements are in `docs/HERO_FRAME_BLENDING.md`.

## Four-stage text choreography

Use the copy from the brief and placements from the design document; these ranges only govern movement. Map opacity/translation to normalized progress so rapid scrolling and reversal never queue stale time-based animations.

| Stage | Enter | Hold | Exit |
| --- | --- | --- | --- |
| 1: opening heading, support, CTA | One-time mount entrance at p=0 | 0.00–0.04 | 0.04–0.14 |
| 2: right atmospheric message | 0.18–0.24 | 0.24–0.43 | 0.43–0.50 |
| 3: left property message | 0.54–0.61 | 0.61–0.80 | 0.80–0.87 |
| 4: centered closing heading/CTA | 0.88–0.96 | 0.96–1.00 and through release | No exit fade within hero |

Batch 4 correction: the user's explicit four-stage timeline replaces the earlier proposed ranges and fully-visible-on-mount rule. Story copy is configured in `src/config/hero-story.ts`; this document governs its motion only.

Use smoothstep `t*t*(3-2*t)` within each scroll entrance/exit window, with no spring or elapsed-time lag. Side narratives enter from 40 px horizontally, reduced to 16 px on portrait/compact screens. Finale rises 36 px, reduced to 20 px portrait or 16 px compact landscape. Exits use restrained fractions of that travel.

Opening eyebrow, headline, description, and CTA have separate mount layers: opacity 0→1 and translateY 28/56/36/28 px→0, durations 1/1.3/1.1/1 seconds, delays .05/.2/.4/.55 seconds, easing [.16, 1, .3, 1]. Portrait mount travel is halved; compact landscape uses 40%. These animations run once when the bounded preparation screen reveals the hero (or immediately when preparation is bypassed); they never wait for the complete sequence. A separate outer layer handles the scroll-driven fade/lift, becoming fully hidden at .14. Returning to the top restores the introduction without replaying its entrance. Static modes skip the mount entrance entirely. Later stages use only scroll-driven transitions; stages 2 and 3 are narrative, not extra controls.

Only visible-stage controls participate in pointer and keyboard interaction; hidden groups must be inert, not merely transparent. If focus is inside an outgoing interactive group, retain that group's visibility until focus leaves, then reconcile it to progress. Do not move focus on scrolling. Ensure a single semantic h1 and avoid repetitive screen-reader announcements; the canvas itself should not announce each frame. The no-motion content alternative must preserve the story and CTA access.

## Loading and rendering reliability

The runtime reads versioned, source-derived WebP profiles: desktop `/frames/manifest.json` points to `/frames/v2/desktop/` (72 frames, 960×540), and mobile `/frames/v2/mobile/manifest.json` points to 60 frames at 720×405. Each records exact source indices/timestamps sampled uniformly through the first and final source composition. The manifest remains authoritative after regeneration. The independent first-frame poster is `/media/hero-poster.webp`. Profile selection occurs once per page mount; resizing changes Canvas placement/cache bounds without replacing the active sequence. Detailed measurements and the approved optimization are recorded in `docs/HERO_PERFORMANCE_OPTIMIZATION.md`.

- Keep the poster loading promptly in the reserved media region. The explicit cinematic-preloader request supersedes the prior no-loader rule: a brief preparation screen may cover the initial hero until every selected frame has downloaded, decoded, and been retained, followed by a successful Canvas draw. This explicitly replaces the three-frame / 2.5-second strategy. Progress counts completed downloads and decodes; 100% additionally requires Canvas readiness. Use a configurable safety deadline (initially 45 seconds), bounded retries, and a static poster fallback on incomplete preparation or insufficient memory. Render semantic content independently; begin the opening entrance at reveal. The successful cinematic path must wait for all selected frames. Skip preparation and sequence downloads for static alternatives and direct lower-page anchors; allow an explicit loading-screen bypass. Reloaded/restored cinematic entries must prepare again without changing scroll restoration.
- Keep the poster underneath the canvas until the first successful decoded draw. Do not reveal a cleared/blank canvas. On total media failure, retain the designed backing surface and accessible copy/actions.
- Prioritize the first frame, then all remaining frames. Limit fetch/decode concurrency to two. Retain the complete decoded active profile within its validated memory ceiling; do not evict and re-decode during normal scrolling. Never request both profiles.
- If a target is unavailable, request it first and retain the last successfully drawn frame or poster. Never block scrolling or draw an empty slot. Redraw when it resolves only if it is still the current target; stale requests cannot overwrite the new selection.
- Use a bounded retry policy (one retry per failed frame), handle decode/network failures, and release evicted bitmap resources. Cancel pending work and remove listeners on unmount; tolerate React StrictMode setup/cleanup cycles.
- Resize the canvas backing store only when needed, cap effective device pixel ratio (initial ceiling 2), and draw again immediately after resizing. Preserve source aspect ratio and source markings according to the design document.
- Suspend loading when the document is hidden or the hero is distant. Retain the completed active sequence for reverse scrolling until teardown or a static-mode switch. Close every bitmap on teardown. The explicit full-frame request supersedes the prior prohibition on retaining the entire sequence. See `docs/FULL_FRAME_PRELOADER.md` for measured memory, policies, limitations, and verification.

The deterministic index is the requested frame, even during a cache miss. Once its frame is ready, its displayed result must match the mapping (or the adjacent fractional composition when blending is enabled); temporary fallback must not alter the timeline.

## Responsive motion and resource budgets

Desktop and tablet retain the same story and progress mapping. Mobile uses a stable viewport measurement (prefer small viewport units where appropriate) to limit address-bar-induced pin jumps. Use the shared 350svh section height on capable mobile devices; text travel is reduced as above. Recompute from the current scroll offset after orientation changes without replaying from the beginning. All four story progress ranges remain unchanged; the finale still reaches full opacity at .96 and holds through 1.00 before sticky release.

The optimized mobile sequence reduces pixel decoding and transfer cost. Variant manifests must map to the same source timeline. Select a variant once per session/viewport change without interrupting the displayed image. Do not upscale the source or require maximum-resolution frames on phones. Full preparation estimates `frameCount × width × height × 4` bytes before fetching. Current selected sequences require 142.4 MiB desktop and 66.7 MiB mobile. Configured decoded ceilings are 160/80 MiB, reduced to 32 MiB on reported ≤2 GB devices and at most 80 MiB on reported ≤4 GB devices. Use the static poster when the sequence exceeds its ceiling or ImageBitmap is unavailable; do not label a partially decoded window as fully ready. These limits exclude Canvas/GPU/browser overhead and do not prove memory safety on every device. Respect Save-Data where exposed; absent connection APIs must not break the feature.

For explicit reduced-data preference or persistently unusable loading, retain a static source poster and a usable short hero, with the closing invitation available without traversing an empty long section. Keep any optional “Enable cinematic motion” action user-initiated. Normal media stalls alone should hold the current frame rather than suddenly collapse a section mid-scroll.

## Reduced-motion alternative

Observe `prefers-reduced-motion` both initially and when it changes. Default to a static source poster, ordinary-height hero, readable opening copy, and accessible closing CTA. Disable frame-sequence downloads, pinned travel, translations, stagger, parallax, and smooth anchor scrolling. Narrative copy can appear in normal reading order. If the preference changes mid-hero, preserve the currently focused element and logical reading position when releasing the pin. Animation is never necessary to reach a destination or understand content.

## Release and other motion

At p=1 hold the last source frame and stage-4 copy. The sticky child releases naturally with its parent; the final composition scrolls away as the featured-properties section enters. Do not fade it to blank, restart the footage, insert a spacer jump, or switch to a second scene. Returning upward re-enters the same mapping. Anchor navigation past the hero must bypass it normally.

Later section reveals may use a one-time 12 px rise and opacity over 350 ms, easing `[0.22, 1, 0.36, 1]`. Hover/focus appearance transitions: 160 ms ease-out. Dialog/menu appearance: opacity and at most 8 px translation over 180 ms; exit 140 ms. Motion must never delay focus management or error feedback. Reduced motion removes these transitions. No continuous decorative loops or artificial camera zoom.

## Motion acceptance for later batches

- Top, quarter, middle, three-quarter, and endpoint scroll positions select the expected manifest frame; repeating in reverse produces identical indices.
- Actual source architecture advances and reverses without autonomous playback; rapid scroll jumps resolve to the latest target.
- Sticky travel spans the planned section, releases naturally, and re-enters correctly; anchor, touch, keyboard, and restored-scroll paths work.
- Four text stages follow their windows; initial copy enters at preparation reveal (after complete preparation, or immediately for a static fallback/bypass) and final copy remains visible until release.
- Cold cache, throttled connection, missing middle frame, decode error, total asset failure, and resize never expose an empty canvas or block actions.
- Focused controls remain visible; hidden-stage controls cannot receive focus. Screen readers receive stable content, not frame announcements.
- Reduced motion uses a short static experience with no sequence fetch; reduced-data mode is usable. Live preference changes preserve reading position.
- Real mobile testing checks rendering cadence, memory, request bounds, aspect ratio, source watermark visibility, and browser toolbar/orientation changes.
- Validate actual asset metadata on every regeneration. Batch 2 completes asset preparation only; none of this motion is implemented yet.
