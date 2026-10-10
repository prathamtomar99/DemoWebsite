# Aether Estates — Visual Design System

## Authority and direction

This document owns HOW the site looks. Product scope and copy belong to `BRIEF.md`; movement, media rendering, and scroll behavior belong to `MOTION_REFERENCE.md`. Subject ownership resolves conflicts, with explicit user instructions taking priority.

Art direction: a warm, minimalist architectural editorial. Pair expressive serif headlines with precise sans-serif body text, generous negative space, restrained bronze accents, and cinematic architectural imagery. Avoid ornamental badges, heavy shadows, glossy panels, or generic icon grids.

## Semantic color tokens

| Token | Value | Role |
| --- | --- | --- |
| `--canvas` | `#F5F1E9` | Warm page background |
| `--surface` | `#FFFCF7` | Raised surfaces and forms |
| `--ink` | `#252821` | Main text and dark buttons |
| `--muted` | `#62645B` | Supporting text on light surfaces |
| `--accent` | `#786044` | Restrained bronze accent |
| `--line` | `#D9D3C8` | Decorative separators |
| `--control-border` | `#7B7B70` | Form boundaries |
| `--on-dark` | `#FFFCF7` | Text on dark surfaces |
| `--cinema` | `#181B17` | Hero backing surface |
| `--focus` | `#81551E` | Focus on light backgrounds |
| `--error` | `#A12C25` | Error text |
| `--success` | `#355B3D` | Completion text |

Keep these in `src/styles/tokens.css`; use semantic variables or mapped Tailwind tokens. Dark-background focus uses `--on-dark`. Decorative lines cannot substitute for visible input boundaries.

## Typography

Intended display face: **Cormorant Garamond**, weight 500; fallback Georgia, serif. Body/interface face: **Manrope**, weights 400/500/600; fallback system-ui, sans-serif. Use licensed WOFF2 assets and `font-display: swap` when assets are added. Batch 1 may use the declared fallbacks; do not imply font files already exist.

| Role | Size | Line height | Tracking |
| --- | --- | --- | --- |
| Hero heading | `clamp(2.75rem, 6.5vw, 6.5rem)` | 1.02 | -0.025em |
| Section heading | `clamp(2.25rem, 4vw, 4.5rem)` | 1.08 | -0.02em |
| Property/dialog title | `clamp(1.75rem, 2.5vw, 2.5rem)` | 1.15 | -0.015em |
| Body | `clamp(1rem, 1.2vw, 1.125rem)` | 1.6 | normal |
| Navigation/buttons | 0.875–1rem | 1.4 | 0.02em |
| Eyebrow/metadata | 0.8125rem | 1.5 | 0.08em |

Use sentence case; reserve uppercase for short eyebrows. Body measures should generally stay within 45–65 characters. Avoid thin text over photography and forced single-line headings.

## Spatial system and responsive composition

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px. Maximum content width: 1360 px. Image fields can extend to the viewport edges.

| Viewport | Grid and gutters | Section spacing |
| --- | --- | --- |
| Mobile below 768 px | Single column; 20 px gutters (16 px at 320 px) | 64 px |
| Tablet 768–1023 px | Six-column grid; 32 px gutters | 80 px |
| Desktop 1024 px and above | Twelve-column grid; 48 px gutters | 112 px |
| Wide desktop 1280 px and above | Capped text container; 64 px outer gutters | 128 px |

A 640 px breakpoint can split short form fields where they remain legible. At 200% zoom, allow natural wrapping and stacking. Interactive targets are at least 44 × 44 px; primary controls are at least 48 px high. Short landscape screens must accommodate content without clipping.

## Hero appearance

A full-bleed cinematic stage carries the house imagery and foreground text. Keep the entrance and principal architectural lines legible. Use a restrained local dark scrim behind text where needed, not a uniform muddy filter. Reserve the source watermark corner; never cover it with copy, controls, or a decorative logo.

Four visual compositions (sequence mechanics belong to the motion spec):

1. Opening headline in the lower-left/left-center field, maximum width about 10–12 characters per headline line; supporting copy below, then primary and secondary actions.
2. Atmospheric copy on the right content rail, right-aligned, leaving the entrance visually open.
3. Property-focused copy on the left content rail, left-aligned, with a compact supporting paragraph.
4. Closing headline and CTA centered within a readable text measure.

On mobile, retain each composition's intent using a compact text block within safe gutters; right-stage copy remains right-aligned. Keep copy above device safe-area insets and away from navigation. Do not crop the architectural entrance or watermark to force a portrait fill. Where full-source framing leaves space on narrow screens, extend the cinema backing surface to all edges and use that negative space for text. Do not invent missing image content. On desktop, use edge-to-edge imagery where the aspect ratio allows preservation of source composition.

## Components and sections

**Navigation:** quiet typographic wordmark, sparse links, rectangular viewing CTA. Over cinema, use light foreground with a subtle readable backing; on content surfaces, dark foreground. Desktop bar approximately 80 px; mobile 64 px. Mobile menu uses a solid warm surface, generous rows, and a clearly visible close control.

**Buttons and links:** dark filled primary on light backgrounds; light filled primary on cinema; secondary outlined or underlined text. Corners 2 px, padding 16–24 px horizontally. Visible focus outline 2 px with 3 px offset. Distinguish hover/pressed/disabled states through fill and border, without relying on movement. Decorative Lucide icons use a consistent restrained stroke and never replace an accessible label.

**Featured properties:** section heading and introduction on opposing desktop rails. Three editorial columns on desktop, two on tablet with the final item using one column, and one on mobile. Image ratio 4:5; minimal framing, title, category, short description, and concept disclosure below. Batch 5 removes price/location/statistic rows to reflect the explicit concept-only content scope. Sample labels stay legible. Avoid deeply nested panels and prominent shadows.

**Agency approach:** broad text-led composition with an oversized heading and three numbered principles separated by fine rules. Stack on small screens; keep decoration secondary to copy.

**Viewing invitation:** spacious dark field with a short light headline and one clear CTA. Maintain the same content rails as adjacent sections.

**Dialogs/forms:** warm surface, subdued dark backdrop, radius 8 px. Detail view up to 960 px wide; enquiry up to 640 px. Padding 24 px mobile / 40 px desktop. Labels above controls, distinct borders, errors immediately below the relevant field, and a visually distinct completion panel. Dialogs fit within viewport insets with legible close controls. Appearance here does not define form logic.

**Footer:** restrained wordmark, sample-site note, and aligned links separated by a thin rule; stack naturally on mobile.

## Imagery, contrast, and acceptance

Architectural visuals retain natural material color, coherent perspective, and useful context. Use source-derived or approved imagery only as allowed by the brief; no invented cinematic scenes. Avoid extreme grading or blur that obscures details. Reserve intrinsic dimensions for images.

- Body text contrast ≥4.5:1, large text ≥3:1, and interactive boundaries/focus indicators ≥3:1 against adjacent backgrounds. Verify actual composites over representative footage, not only palette pairs.
- Headline/action hierarchy is clear even when media is unavailable; fallback appearance is intentional.
- Review at 320, 375, 768, 1024, and 1440 px, plus short landscape and 200% zoom. No clipped text, hidden actions, or horizontal overflow.
- All four hero compositions remain readable while architecture and source markings stay visible.
- Tokens, type hierarchy, spacing, image treatment, cards, and forms are consistent. Batch 1 implements only the minimal placeholder foundation; the full design review belongs to later batches.
