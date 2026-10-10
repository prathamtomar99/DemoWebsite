# Aether Estates — Product Requirements

## Authority

This document owns WHAT is built: audience, content, scope, functionality, assets, and product acceptance. `DESIGN.md` owns appearance and responsive composition. `MOTION_REFERENCE.md` owns scrolling, rendering, and animation. Explicit user instructions take precedence; otherwise resolve each decision using its subject's owner, without a ranking between the three documents. These specifications replace earlier versions. Future work must preserve the mandatory scroll-controlled cinematic hero.

## Purpose and positioning

Aether Estates is a fictional boutique real-estate agency presenting distinctive contemporary homes to discerning buyers, relocating families, and architecture-minded property seekers. Convey thoughtful curation, personal guidance, and a clear route to requesting a private viewing. The temporary name must be configurable.

This is a concept demonstration, not an operating agency or a verified inventory. Label sample listings visibly; do not fabricate transactions, awards, testimonials, office addresses, or agent credentials.

## Scope and technology

Build a single-page frontend with Vite, React, TypeScript, Tailwind CSS, Motion for React (the current Framer Motion package, imported from `motion/react`), and `lucide-react`. Use npm and commit its lockfile. No backend, account system, payment flow, live availability, CRM, or actual appointment booking is included.

The essential experience is a cinematic, scroll-controlled journey through the supplied house, followed by normal page content. Its exact behavior is owned by `MOTION_REFERENCE.md`. A usable non-animated alternative is required.

## Single-page structure

Batch 5 correction: explicit user requirements replace the initial sample listing statistics, navigation labels, and enquiry fields. No prices, addresses, sale statuses, floor areas, or bedroom/bathroom counts are included.

1. **Header:** configurable wordmark, Home (`#home`), Properties (`#properties`), About (`#about`), and Contact (`#contact`). Accessible mobile menu closes on selection. Preserve the hero bypass anchor `#after-hero`.
2. **Cinematic hero (`#home`):** preserve the supplied-footage experience and four story stages. Both collection CTAs link directly to `#properties`; keep the separate bypass link functional.
3. **Featured properties (`#properties`):** three image-led concepts, each with a visible concept label, title, category, short architectural description, and Explore Residence action. Details open accessibly and offer a viewing demo with the property preselected.
4. **Agency introduction (`#about`):** fictional agency philosophy, with no invented history, awards, testimonials, or credentials.
5. **Our approach (`#approach`):** Curated Residences, Private Viewings, and Property Advisory, framed as intended services.
6. **Viewing invitation (`#contact`, legacy `#enquire`):** closing invitation, viewing-demo action, and collection link.
7. **Footer:** brand name, Concept website disclosure, working navigation, and Back to top. Do not invent contact destinations.

### Configurable hero copy

Batch 4 correction: the user's approved storytelling copy and collection-directed CTAs replace the initial proposed copy and viewing actions below. Viewing-request functionality remains in the later full-page scope; Batch 5 now links both hero actions to the implemented `#properties` collection; `#after-hero` remains the compatible bypass anchor.

- Opening: “Beyond the expected.” Supporting copy: “Explore exceptional architecture and discover a more considered vision of modern living.” Eyebrow: the configured brand name. Action: “Explore Properties”.
- Atmospheric message: “Every perspective reveals something extraordinary.” Eyebrow: “Architectural distinction”.
- Interior message: “Step inside a world of considered living.” Eyebrow: “Designed to inspire”.
- Closing: “Where extraordinary living begins.” Eyebrow: “Discover” followed by the configured brand name. Action: “Explore Our Collection”.

### Clearly labelled sample property content

These are fictional concepts, not verified inventory. Each card and detail view must visibly state “Concept property · Not a market listing”. Independently licensed photography is illustrative and does not depict properties represented by the fictional agency.

| ID | Name | Concept category |
| --- | --- | --- |
| woodland | The Woodland Residence | Garden residence |
| horizon | The Horizon House | Modern coastal residence |
| courtyard | The Courtyard Estate | Architectural family home |

No actual listing statistics or ownership claims. Do not imply three different properties were filmed in the source video.

## Viewing request interaction

Use one accessible dialog with full name, email, optional phone, property (including General enquiry), preferred viewing date, and optional message. Name, valid email, property selection, and preferred date are required. The date cannot be in the past and is a preference, not a booking confirmation.

Show “Demo only. Your information will not be sent or stored.” before submission. Valid submission displays “Demo complete. No viewing request has been sent.” No network delivery, analytics capture, storage, or persistence of personal data. Clear entered details on close. Errors are inline, linked to fields, and announced accessibly; focus the first invalid field. Dialogs support Escape, contained focus, focus restoration, a visible close control, and internal scrolling. Only one dialog may be active; returning from a detail-to-enquiry flow restores focus to a valid launching control.

## Configuration and assets

`src/config/site.ts` is the initial brand configuration. Extend this configuration in later batches for navigation, copy, sample listings, CTA labels, and media manifest/poster references. Keep types separate when they grow; components must not duplicate content constants.

The source master is `assets/source/DroneVideo.mp4`. Preserve it unchanged and outside public build output. It is the single source of truth for the cinematic architecture. No generated replacement footage or invented video scenes. Derived frames and their manifest belong under `public/frames/`; the poster belongs under `public/media/`, with a configurable manifest so a properly licensed clean export can replace the source without changing rendering code.

The source contains a visible Gemini watermark, an existing asset limitation. Do not claim removal or intentionally conceal it. Record provenance and sample status. Replacement imagery/fonts require appropriate usage rights; do not invent missing assets or asset metadata.

## Product accessibility and performance

Target WCAG 2.1 AA: semantic landmarks, one primary heading, logical headings, keyboard operation, visible focus, labelled controls, understandable errors, and an equivalent reduced-motion experience. Essential content and enquiries remain usable when media is unavailable. Avoid inaccessible hidden controls, horizontal overflow, and layout shifts. Support touch, keyboard, browser zoom, and narrow screens.

Core Web Vitals targets for later representative mobile testing: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1. These are verification targets, not current measurements. Load below-fold imagery lazily, keep unused dependencies out of runtime bundles, reserve media dimensions, and avoid downloading the full media sequence before the page becomes usable. Define loading mechanics only in the motion specification.

## Functional acceptance

- Brand and content can be changed centrally; all copy concerns real estate and sample status is visible.
- Every navigation/CTA has a valid destination or implemented action.
- Mandatory supplied-footage scroll hero passes the motion specification; content remains accessible without motion or successful media loading.
- Three labelled sample listings expose accurate-to-config details and viewing preselection.
- Enquiry validation, focus handling, demo completion, and no-data-retention behavior work on keyboard and touch.
- Responsive layout passes the design specification; production build and TypeScript checks pass.

## Milestones and batch gate

1. **Batch 1 (completed):** replace all three specs, scaffold dependencies/configuration, add only a brand placeholder, inspect source metadata if tools permit, run type/build checks, and report limitations. No frame extraction, hero, listing components, dialogs, or animations.
2. **Batch 2 (authorized, assets only):** inspect the source, prepare optimized sequential JPEGs and a poster, generate verified metadata, and provide a safe reusable processing script. No hero or other UI implementation.
3. **Batch 3 (requires user approval):** implement viewport-aware loading, caching, canvas rendering, scroll synchronization, and fallback paths. Preserve the pinned hero and deterministic bidirectional requirements.
4. **Batch 4 / later approved work:** implement four-stage text choreography and the remaining navigation, listings/details, approach, and viewing demo interactions.
5. **Final validation:** responsive and assistive-technology checks, media failure/slow-network tests, performance measurements, and content/provenance review. Publishing is a separate decision.
