# Batch 6 — Final quality audit

Verified locally on 2026-10-10. This is a refinement of the existing concept website, not a redesign or deployment. BRIEF.md, DESIGN.md and MOTION_REFERENCE.md remain unchanged. The source video, 240 extracted frames, Canvas renderer, loader budgets and four-stage timeline were preserved.

## Findings and corrections

| Finding | Verification / significance | Smallest fix and regression coverage |
| --- | --- | --- |
| Hero poster discovered only after application JavaScript | Baseline Lighthouse LCP discovery failed; mobile LCP 5.78 s | Preload the existing poster in `index.html`. No frame preloads. Unit test keeps the URL aligned with site configuration. |
| `/robots.txt` returned the SPA HTML | Lighthouse reported 17 invalid directives | Add a real `public/robots.txt` denying crawling. Keep `noindex, nofollow`. |
| WebKit cold fragment URLs and history returns could stay at scroll position zero | `?qa-deep#properties` and back navigation reproduced the failure | Page-level `useSectionAnchor` recovers a missed anchor after mounting/pageshow/hashchange. Existing nonzero native restoration takes precedence; subscriptions and scheduled work clean up. Three-engine regression covers this. No hero scrolling logic changed. |
| WebKit skipped implicit dialog button/link tab stops | Default macOS keyboard preference could take Tab from the textarea to browser chrome | Explicit zero tab stops before native Tab traversal. Keep native date-segment keyboard behavior and the existing boundary wrap. No positive tabindex values. |
| WebKit click did not focus the invoking button | Closing details/viewing restored the wrong active element | Pass the actual triggering element from cards, menu and closing CTA. Preserve it across the detail-to-form handoff. Tested Escape, repeated opening and restoration in all three engines. |
| Empty favicon and missing sharing description | Document-head inspection | Local SVG initial using the existing palette; accurate concept-only Open Graph title/description/type. No invented domain, canonical, listing schema or business claims. |

The navigation fallback is deliberately limited to an unresolved fragment at position zero; it does not continually enforce an anchor or take over scrolling. Its principal regression risk is history restoration, covered by the new browser suite and existing hero tests. Modal fixes affect keyboard order and return focus, covered at every tested size.

Visual review found the existing editorial composition coherent. No arbitrary typography, palette, layout or animation redesign was warranted. Mobile keeps the complete source composition rather than stretching it into portrait format. The Gemini watermark remains visible.

## Production performance

Lighthouse **13.5.0**, temporary `npx` invocation, installed Chrome, production build at `http://127.0.0.1:4173/`. Default simulated mobile throttling and `--preset=desktop`; categories performance/accessibility/best-practices/seo. Reports are JSON and HTML in `artifacts/qa-{baseline,final}-{mobile,desktop}.report.*`.

The baseline is one run per device. Final mobile was repeated twice because the first result was unstable. The table uses the median of the three final mobile runs; desktop is one final run. These are local lab measurements, not controlled proof of causation, real-device guarantees, field Core Web Vitals or measured INP.

| Metric | Mobile before | Mobile final median | Desktop before | Desktop final |
| --- | ---: | ---: | ---: | ---: |
| Performance | 66 | 94 | 97 | 100 |
| Accessibility | 100 | 100 | 100 | 100 |
| Best Practices | 100 | 100 | 100 | 100 |
| SEO | 58 | 66 | 58 | 66 |
| FCP | 1.569 s | 1.655 s | 0.383 s | 0.406 s |
| LCP | 5.782 s | 3.005 s | 0.588 s | 0.606 s |
| CLS | 0 | approximately 0 | 0.000048 | 0.000048 |
| TBT | 481 ms | 9 ms | 146 ms | 47 ms |
| Speed Index | 2.761 s | 1.655 s | 0.586 s | 0.521 s |
| Transferred resources | 886,445 B | 887,026 B | 1,412,914 B | 1,413,495 B |

**Worse results are retained:** final mobile scores were **64, 94, 94**, LCP **5.586, 3.005, 3.005 s**, TBT **529, 9, 3 ms**. The first final run was worse than baseline for score, FCP, TBT and Speed Index (3.589 s). Median mobile FCP rose by about 85 ms; desktop FCP and LCP rose by about 23/18 ms. Transfers increased by 581 bytes. The earlier intermediate preload-only run scored 95; it is not the final-build result. Do not present the best run alone as a guarantee.

Lighthouse now confirms the poster is discoverable in the initial document. The slower mobile run attributes most startup work to script evaluation and style/layout; its LCP breakdown includes substantial render delay. The 175 KiB JPEG poster and unused startup JavaScript remain optimization opportunities, but this batch does not replace working motion infrastructure or recompress source imagery just to improve a score. Mobile median LCP remains above 2.5 s. Recheck on target phones and the eventual host.

| Build output | Before | Final |
| --- | ---: | ---: |
| JavaScript raw / gzip | 379.15 / 120.54 kB | 379.85 / 120.71 kB |
| CSS raw / gzip | 25.27 / 6.47 kB | 25.31 / 6.48 kB |

Lighthouse ran before the final documentation-only build. Tailwind’s automatic content scanning added about 0.04 kB of raw utility CSS when the QA documentation was written; the final build sizes above include that difference. Application behavior did not change after those measurements.

No project dependency changes. JS increased by **0.17 kB gzip** for the compatibility fixes. Initial mobile observation fetched the manifest and **three frames**, not all 240. No below-fold property photographs were preloaded. Fonts remain local WOFF2 with swap behavior.

A Chromium DevTools timeline sample during stepped forward/reverse scrolling recorded 158 FunctionCall events (34.3 ms total, maximum 4.71 ms), 44 Paint events (6.76 ms total, maximum 0.65 ms), and no Layout events in the filtered sample. A concurrent Long Tasks observer recorded **zero tasks over 50 ms**. Cache finished at **18/18**, frame 1. This short, unthrottled local sample does not establish real-device frame rates or INP. See `qa-scroll-trace-summary.json` and the approximately 1.1 MiB local `qa-hero-demo.webm`.

Preview serves media with ETag and `Cache-Control: no-cache`; it is not production hosting policy. Keep immutable caching for fingerprinted assets, and introduce versioned media URLs before assigning long immutable lifetimes to replaceable frames. No hosting configuration or deployment was invented.

## Functional and browser coverage

- **Chromium/Chrome, Firefox 156 and Playwright WebKit 26.6:** production suite passed in all three. Forward/reverse samples selected frames 1, 61, 156, 228, 240 and back; refresh at intermediate progress, cold fragments, history return, leaving/re-entering the sticky section and release worked.
- Responsive production checks in each engine: **1920×1080, 1440×900, 1024×768, 768×1024, 390×844, 375×812, 320×568, 844×390**. No horizontal page or dialog overflow detected. Internal form scrolling, menu navigation, validation focus, dialog containment and restoration passed.
- All existing hero resilience, story, story-edge, accessibility and touch cases passed: delayed/missing/corrupt frames, stale-request protection, rapid direction changes, resize, idle/offscreen suspension, bounded caching and cleanup, hidden stage controls, focused CTA holds, intro recovery and final-stage persistence.
- All three concept details, CTA destinations, `#after-hero`, menu Escape/navigation, repeated dialog handoff, preselection, invalid email/required feedback, cleared values and demo success passed the existing website suites.
- Reduced-motion and simulated Save-Data load the static poster and make **zero manifest/frame requests** in all three engines.
- **Actual Safari 26.5 was not tested.** SafariDriver session creation was rejected because “Allow remote automation” is disabled. No Safari settings were changed. Playwright WebKit is not Safari.
- Firefox/WebKit and Playwright's recording helper were downloaded into the user browser cache; no system package or application dependency was installed.

## Accessibility and visual evidence

Axe-core checks tagged WCAG 2 A/AA, 2.1 AA and 2.2 AA reported **zero violations across 11 settled states**: four hero stages, four content sections, property details, invalid viewing form and mobile menu. Some scans retained `aria-prohibited-attr`/`color-contrast` incomplete items, so automated results are not a complete conformance assessment. Image-backed text and transitional opacity require human review.

Keyboard checks verified the visible skip link, focus rings, hidden/inert story controls, modal containment, Escape, return focus, and invalid-field focus. A **keyboard-only form completion** using Tab, typing and native select/date keyboard input reached the correct demo success message, with zero submission requests and unchanged storage. Semantic Canvas decoration, real text/links, labels and error associations remain intact.

The initial accessibility script sometimes pressed Tab before the React controls existed under concurrent test load. It now waits for the visible skip link; its assertions are unchanged and include diagnostic focus details. Reused browser sessions also caused retained-dialog/focus test failures; final suites ran in isolated sessions. An automated contrast scan caught a section midway through its entrance; rescanning settled content passed. These harness failures were investigated rather than weakening assertions.

No actual VoiceOver/screen-reader session was performed. Browser zoom shortcuts in automation did not change `innerWidth`, DPR or visual scale, so **actual 200%/400% zoom is unverified**. Compact/reflow viewports, including the existing 720×450 check, are not a substitute. Physical mobile keyboards, touch hardware and low-end devices also remain untested.

Screenshots were reviewed for text wrapping, section alignment, image crops, focus visibility, dialog composition, mobile form scrolling and source watermark visibility. Full-page captures necessarily include the 500svh scroll distance; the empty travel region in a still image is not an added page section.

- [Evidence gallery](../artifacts/qa-gallery.html)
- [Desktop full page](../artifacts/qa-full-1440.png), [mobile full page](../artifacts/qa-full-375.png)
- Hero [opening](../artifacts/qa-hero-0.png), [middle](../artifacts/qa-hero-65.png), [finale](../artifacts/qa-hero-95.png)
- [Collection](../artifacts/qa-properties.png), [property dialog](../artifacts/qa-property-dialog.png), [agency](../artifacts/qa-agency.png), [viewing form](../artifacts/qa-viewing-dialog.png), [closing CTA](../artifacts/qa-closing.png), [footer](../artifacts/qa-footer.png), [mobile menu](../artifacts/qa-mobile-menu.png)
- [Forward/reverse recording](../artifacts/qa-hero-demo.webm)

Evidence stays local in the ignored `artifacts/` directory; it is not part of the production bundle.

## Security, privacy, SEO and media

`npm audit` reports **0 vulnerabilities** at every severity. Source review found no form network calls, analytics, persistence, dynamic HTML injection or unnecessary remote runtime services. A credential-pattern scan of application/public/script files found no matches; this is not a comprehensive repository-history or penetration audit. React renders configurable copy as text. Attribution links use `rel="noreferrer"` and announce the new tab. No real personal information was used in testing.

The demonstration form remains transient and local. Validation completion clears its values; closing unmounts it. Network/storage instrumentation confirms no booking request or persistent writes. No credentials, backend, analytics or third-party form service was added.

The intentional indexing prohibition is retained in HTML and robots.txt. Final Lighthouse SEO's sole failing audit is `is-crawlable`; lifting that would conflict with the concept-site requirement. No fake canonical domain, business details, structured data or actual listing claims were added. OG imagery/canonical should be configured only once a real deployment origin and approved media exist.

All three source pages and the [Unsplash licence](https://unsplash.com/license) were rechecked against [IMAGE_SOURCES.md](IMAGE_SOURCES.md); the documented photographers and free-use licence still correspond. Local WebP srcset delivery works, chooses the 480-width variant in the 390 px test, preserves proportions through deliberate CSS cover crops, and uses lazy/async loading. Injected image failure retains the reserved image area, descriptive alt text and working action; no replacement photograph is invented.

The drone source SHA-256 remains `279e8283475539b00d22fd6805f45f2b78be19aeb85e626e119b3d35555e9320`. Neither source nor sequence nor agency still was changed. Its visible Gemini watermark and unresolved commercial rights remain a publication limitation. Supply a suitably licensed clean export if current rights/branding conditions do not permit the intended use; no removal or concealment has been performed.

## Modified files and executed checks

Application changes: `index.html`, `public/favicon.svg`, `public/robots.txt`, `src/hooks/use-section-anchor.ts`, `src/pages/HomePage.tsx`, `src/components/shared/{Modal,ExperienceProvider}.tsx`, `src/components/shared/experience-context.ts`, `src/components/properties/PropertyCard.tsx`, `src/components/contact/ClosingCTA.tsx`, `src/components/navigation/SiteNavigation.tsx`.

Verification/docs: `tests/document-policy.test.mjs`, `tests/qa-browser.js`, `tests/qa-keyboard-browser.js`, the readiness wait in `tests/hero-accessibility.js`, `README.md`, and this document. No primary specification changes.

| Check | Final outcome |
| --- | --- |
| TypeScript | Pass |
| Lint | Pass |
| Production build | Pass |
| Unit tests | **7 passed, 0 failed** (all original 6 preserved) |
| Existing browser suites | **8 passed, 0 failed** |
| New production compatibility suite | **3 engine runs passed, 0 failed** |
| Additional keyboard-only journey | **1 passed, 0 failed** |
| Automated accessibility states | **11 checked, 0 violations**, incomplete checks noted above |
| Dependency audit | **0 vulnerabilities** |

Use a fresh CLI session for each existing browser suite because they intentionally set media preferences, focus and fault-injection routes. Dev regressions target port 5173; new production checks target 4173. The new production script covers the verified WebKit defects without weakening prior assertions.

## Readiness

**Ready for a premium client demonstration in the tested scope.** No known material functional defect remains in those checks. Mobile startup variance, real Safari, actual screen-reader use, 200%/400% browser zoom and physical-device testing are explicit remaining validation work, not claims of universal compatibility or complete WCAG compliance.

Commercial publication additionally requires approved brand/business identity, genuine listing media and rights review, resolution of source-video rights/branding, a real domain/hosting security and cache policy, and a separately authorized privacy-compliant enquiry delivery design if real submissions are wanted. Recheck performance and accessibility on that deployment before lifting noindex. Nothing was deployed, no backend was added, and work stops at Batch 6.
