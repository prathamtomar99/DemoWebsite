# Batch 5 — Complete concept website

## Scope and architecture

The existing cinematic hero now leads into Featured Properties, Agency Introduction, Our Approach, a closing viewing invitation, and the footer. This is one React page with no routes, backend, real inventory, or booking integration. Batch 6 is not started.

### New components and files

- `components/navigation/SiteNavigation.tsx`, `MobileMenu.tsx`: desktop links, content header, and native mobile menu dialog.
- `components/properties/FeaturedProperties.tsx`, `PropertyCard.tsx`, `PropertyDetailsDialog.tsx`: three configured concepts and their editorial detail experience.
- `components/agency/AgencyIntroduction.tsx`, `OurApproach.tsx`: fictional agency philosophy and three proposed services.
- `components/contact/ClosingCTA.tsx`, `ViewingRequestDialog.tsx`, `viewing-validation.ts`: closing invitation, transient form, pure validation.
- `components/layout/Footer.tsx`: wordmark, concept disclosure, working section links and return link.
- `components/shared/ExperienceProvider.tsx`, `experience-context.ts`: one active dialog state and original-trigger tracking across the property-to-form handoff.
- `components/shared/Modal.tsx`: native modal lifecycle, scroll lock cleanup, Escape and explicit keyboard wrapping.
- `components/shared/PropertyImage.tsx`, `Reveal.tsx`: responsive local imagery and once-only restrained section reveals.
- `config/properties.ts`, `config/navigation.ts`: typed property content, image credits, and navigation destinations.
- `styles/website.css`: responsive content, controls, dialogs, menu and footer using the existing design tokens.
- `public/images/`: nine responsive WebPs plus one existing-frame copy for agency imagery.
- `assets/reference/`, `scripts/prepare-property-images.sh`, `docs/IMAGE_SOURCES.md`: still-photo provenance and reproducible derivative downloads.
- `tests/viewing-validation.test.mjs`, `website-browser.js`, `website-accessibility.js`: new form, interaction and accessibility checks.

### Existing files changed

`HomePage.tsx` composes the sections inside the interaction provider. `ScrollHero.tsx` accepts an optional navigation slot and makes its Home anchor focusable; its playback and storytelling code is unchanged. `config/hero-story.ts` changes only CTA destinations to `#properties`.

`styles/hero.css` removes duplicate reduced-motion geometry declarations. The existing `data-static` styles and `useHeroMode` remain the sole source of static geometry. This fixes an observed live-preference race: CSS previously collapsed the section before the hook could capture the original reading position when new reduced-motion subscribers were present. No frame-loader, renderer, cache, progress formula, or mode-hook code changed.

`README.md` now documents the complete website. Targeted `BRIEF.md` corrections remove the older invented listing statistics and align navigation, concepts, form fields and hero CTA destinations with the explicit Batch 5 request. One sentence in `DESIGN.md` removes obsolete price/location rows. `MOTION_REFERENCE.md` and the historical hero reports remain unchanged.

Two existing story test scripts were adapted to the now-real `#properties` target, the additional header links in tab order, and scoped hero CTA locators. Frame behavior assertions were not relaxed. The four original Batch 3 browser scripts remain unchanged.

## Visual design and content

The existing Cormorant Garamond/Manrope pairing, warm canvas, ink, bronze accent, spacing and control tokens continue throughout. The collection uses three editorial columns at 1024+, two at 768–1023, and one below 768; all card images have a 4:5 visual field. Agency copy and a complete source still form a two-column composition on tablet/desktop. Numbered service rows replace icon-heavy cards. The closing invitation is a spacious dark field, followed by a restrained footer.

All three concepts have the same structure: title, category, architectural description, visible concept disclosure, and Explore Residence action. The Woodland Residence uses a garden-residence category to match the selected photograph rather than falsely describing its gabled architecture as a contemporary villa. No addresses, prices, room counts, areas, sale statuses, testimonials or credentials are invented.

## Imagery and licences

See [IMAGE_SOURCES.md](IMAGE_SOURCES.md) for exact source pages and CDN paths. Photographs by Ralph Florent, John Fornander and Jeffrey Eisen are each identified as free under the [Unsplash License](https://unsplash.com/license) on their respective source pages. Attribution is optional under that licence; the dialogs include credits and source links. The photos are explicitly illustrative, not represented listings.

Each photo has locally hosted 480/800/1200px WebP derivatives and `srcset`/`sizes`. Card images are lazy-loaded with stable reserved dimensions. A detail view loads only the selected image. No runtime hotlinks or paid services. The local FFmpeg lacks libwebp, so the documented script downloads sized WebP derivatives from the verified image CDN; no system installation was needed.

The agency still is an unchanged copy of frame 0156 under a separate editorial-image path. It preserves the full source frame and visible Gemini watermark. Source video SHA-256 remains `279e8283475539b00d22fd6805f45f2b78be19aeb85e626e119b3d35555e9320`. No video or sequence regeneration occurred.

## Navigation and dialogs

The existing hero top bar retains its wordmark and bypass link, with quiet desktop navigation and a compact mobile menu control added in its safe top area. The content header begins after the hero and sticks at the top while visiting the new sections. This avoids introducing a second fixed bar over the cinematic architecture. There are no new scroll listeners or input interception.

| Destination | Behavior |
| --- | --- |
| `#home` | Native anchor to the cinematic opening |
| `#properties` | Both hero CTAs, Properties navigation, closing secondary CTA; focuses the actual collection |
| `#after-hero` | Backward-compatible hero skip target at the start of the content wrapper |
| `#about` | Agency introduction |
| `#approach` | Proposed service principles |
| `#contact` | Closing invitation and working viewing-demo button |
| `#enquire` | Legacy alias within the contact section |

The mobile menu closes on Escape, its close button, or link selection. Selection moves focus to the destination after unmount; cancellation restores focus to its trigger. Header height is accounted for by section scroll margins.

Native `showModal()` supplies background inertness and dialog semantics. Explicit Tab/Shift+Tab wrapping keeps keyboard focus among available controls. Root overflow locks background scrolling while retaining the existing document position; cleanup restores the prior value. Dialogs scroll internally and fit within dynamic viewport insets. Only one dialog is mounted at a time. The viewing form replaces a property detail dialog, retaining the original card as the return-focus target.

## Demo form and privacy behavior

Visible labels cover full name, email, optional phone, property/general interest, preferred date, and optional message. Name, valid email, known property/general selection and a current/future preferred date are required. Validation rejects impossible calendar dates as well as past dates. Errors are inline, linked with `aria-describedby`, summarized with an alert, and focus moves to the first invalid field.

The pre-submit disclosure is “Demo only. Your information will not be sent or stored.” Valid completion says “Demo complete. No viewing request has been sent.” Values are cleared immediately at completion and the form is unmounted on close. Input values exist only in transient component state. No fetch, webhook, email delivery, analytics, console data logging, localStorage, sessionStorage or cookies are used by the form.

## Executed verification — 2026-10-10

Chromium tests ran against the local Vite app with the installed Playwright CLI.

- TypeScript validation: passed.
- Lint: passed, zero warnings after moving shared exports out of component modules.
- Production build: passed.
- Node tests: all six passed, including the five existing cases and new viewing validation coverage.
- Existing core hero suite: passed. Forward/reverse frames, cache bounds, idle paint, poster, responsive dimensions, sticky release, initial reduced motion and live preference changes.
- Existing accessibility suite: passed. Skip-link keyboard focus, one h1, compact layouts, Save-Data with zero sequence requests, and total media failure.
- Existing resilience suite: passed. Slow loading, rapid seeking, resize, bitmap release, missing-frame retry, bad manifest, corrupt images, offscreen suspension, and no stale paints.
- Existing touch suite: passed under emulated iPhone 13. Swipe advanced to frame 37; skip/back navigation worked; DPR remained capped at 2.
- Story and story-edge suites: passed with updated destination/tab-order expectations. Four stages, gaps, reverse/jumps, intro interruption recovery, focused CTA hold, static-mode focus recovery, and no text clipping.
- Website journey suite: passed. Three correct cards/details, Escape and focus restoration, single-dialog handoff, property preselection, required/email validation, success, clean reopening, navigation, mobile menu, and responsive dialogs.
- Additional website accessibility suite: passed. Forward/reverse focus containment, locked background scroll, mobile completion, short-landscape validation, and restored trigger focus.
- Submission instrumentation recorded zero external or non-GET requests and unchanged localStorage, sessionStorage and cookies. Runtime/console monitoring in the normal website and storytelling journeys recorded no unexpected errors or warnings. Failure-injection suites produce intentional network failures.

Viewport checks included 1440×1000 desktop, 768×1024 tablet, 375×812 and 320×568 phones, 812×375 landscape, and a 720×450 form check. New content had no horizontal overflow; small-screen forms remained internally scrollable and submittable. Existing story checks additionally cover 390×664 and 1440×720.

Screenshots were visually reviewed for spacing, responsive columns, text wrapping, imagery, dialogue contrast and watermark visibility. Evidence lives in ignored local `artifacts/`: `website-properties.png`, `website-property-dialog.png`, `website-agency.png`, `website-viewing-form.png`, `website-closing.png`, `website-mobile-navigation.png`, `website-mobile-form.png`, `website-{768,375,320,812}-collection.png`, `website-desktop-full.png` and `website-content-desktop.png`. The full-page capture necessarily includes the hero's 500svh scroll distance; it cannot represent a pinned moving experience as one static composition. The content-only capture is provided for reviewing the new sections.

## Performance

No dependencies added. Production JS is 379.15 kB / **120.54 kB gzip**, versus Batch 4's 115.48 kB gzip: approximately **+5.06 kB gzip**. CSS is 25.27 kB / **6.47 kB gzip**. All new public image files together total 1,372,751 bytes; this includes every responsive variant, not the amount a browser downloads for one layout.

The frame cache still holds at most 18 decoded desktop bitmaps (6 mobile); the instrumented run observed a transient peak of 19, at most four requests, no stale paints, and full bitmap disposal when motion was disabled. Sample CLS was approximately 0.000046. Idle/offscreen rendering remains event-driven. Section reveals use once-only viewport observation, 16px travel and 450ms transitions; reduced motion displays content immediately. Media subscriptions clean up; there are no new permanent animation loops. These are local measurements, not field Core Web Vitals or a low-end-device benchmark.

## Limitations and handoff

No known functional defect remains in the tested scope. Physical phones, real mobile keyboards, Safari/WebKit, screen-reader sessions, true 200% browser zoom, Lighthouse and field LCP/INP were not tested. Chromium viewport/touch emulation and a short landscape form check do not replace those tests. Photography is illustrative and should be replaced with approved listing media before a real agency launch. The source watermark remains visible; no clean licensed export has been supplied. The existing noindex setting remains appropriate for this fictional demo.

The form intentionally cannot deliver an enquiry or book an appointment. No production contact destinations, legal identity or business credentials have been supplied. Batch 5 is ready for review; Batch 6 and publication require the user's next approval.
