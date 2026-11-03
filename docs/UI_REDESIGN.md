# MASAR workspace redesign

## Audit and scope

The active application is `App.tsx` → `Demo.tsx` → `PlatformPages.tsx`. It includes the employee home, seven department detail pages, the onboarding guide, three procedures, thirteen documents and their reading pages, Ask Masar, and missing-page states. Bookmarked `/demo` routes redirect to the same application.

The old global `styles.css` was loaded alongside a second stylesheet with accumulated overrides, repeated viewport sizing, competing minimum heights, and multiple card treatments. The redesign replaces the active styling entry point rather than adding another override layer. The old file and inactive components remain in the repository; they are no longer loaded by the active application.

There is no active profile/settings route or standalone interactive task/checklist page in this branch. The previous account-dependent implementation in `pages/WorkspacePages.tsx` is not mounted by `App.tsx`. This design-only change does not activate those features, add authentication, or create task state. The existing onboarding steps remain available and unchanged.

## Creative direction: the sky-blue gateway

The current identity uses light sky blue for emphasis, very light gray for the application canvas, white for clear surfaces, soft blue controls, and dark slate typography. Shared semantic tokens cover navigation, hero surfaces, primary controls, hover, focus, disabled, loading and status colors. The former ink/citron surfaces and hardcoded green accents have been removed from active styles.

The original mark is a geometric gateway in perspective with one continuous path passing through its opening. The far gateway pillar is drawn over the path to establish depth and passage. It has no arrow, door hardware, or stock-icon geometry. `public/masar-gateway.svg` is the single source used by `GatewayMark.tsx`, desktop navigation, the mobile header, contextual brand signatures and the SVG favicon. Arabic «مسار» and the MASAR wordmark are paired consistently. Intrinsic image dimensions reserve space before the shared asset loads.

The existing page compositions, numbered navigation order, seven departments, thirteen documents and three first-day steps remain intact. No company facts, policies, metrics, features or assistant behavior were invented.

Motion is progressive enhancement through `usePageMotion.ts`: a single IntersectionObserver per mounted page, cleaned up on navigation, with short transform-only entry transitions. Off-screen content remains readable before observation. Arabic is animated as intact text blocks, without splitting or disrupting glyph shaping. Navigation, interactive rows, source expansion and message arrival provide small, consistent feedback. Both operating-system reduced-motion changes and the existing saved preference suppress animations. No animation or image library was introduced.

## Design foundations

- `frontend/src/design/tokens.css`: semantic color, typography, spacing, radius, focus, navigation, and page-gutter tokens. Light sky blue, very light gray, white, soft blue controls and dark slate form the shared palette. Navigation, hero, control, border, placeholder, focus and status tokens replace direct component colors.
- `frontend/src/design/foundation.css`: one reset, local Arabic typography, accessible keyboard focus, skip navigation, and reduced-motion preferences.
- `frontend/src/design/Primitives.tsx`: reusable page headers, search fields, and searchable-list empty states. Existing Lucide icon primitives provide consistent department identities. `GatewayMark.tsx` uses the same original vector asset as the favicon.
- `frontend/src/demo/demo.css`: a single ordered stylesheet for the shell, shared controls, page-specific layouts, and responsive rules. Spacing uses the shared 4px scale. Logical borders, padding, and alignment preserve RTL.

## Page patterns

| Surface | Layout and purpose |
| --- | --- |
| Shell | Light navigation, a soft blue current destination, white utility header, full application canvas. Mobile navigation remains keyboard operable. |
| Employee home | Full-width light-sky/white opening composition and actions, first-day route, numbered destination columns, company/department reference links. No fake metrics or activity feed. |
| Department directory | Searchable two-column records on desktop and single-column entries on mobile; distinct icons, readable names, service summaries and clear destination links. |
| Department details | Responsibility and service sections separated by spacing; a compact contact context panel; direct source link. |
| Onboarding and procedures | Numbered reading paths with a continuous sequence; related departments and assistant actions use a supporting column on wide screens. |
| Document library | Search and category controls above aligned document records; metadata stays secondary; rows reflow on mobile. |
| Document reader | Readable text measure and larger body typography; supporting contents/metadata column; stacked on mobile. |
| Ask Masar | Viewport-sized application canvas, one message scroller, stable composer. Assistant answers are unboxed; user turns use compact pale-blue backgrounds. Evidence expands inline with direct source links. Existing welcome suggestions disappear after the first turn. |
| Empty/missing/status | Consistent shared typography, icons, spacing, focus and recovery actions; existing verified/uncertain/unavailable and typing states preserved. |

No catalog, assistant intent, message lifecycle, API, authentication, secrets or Supabase behavior changes are included.

## Validation

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`: passed, 32 unit tests.
- `npm run build`: passed.
- `npm run test:e2e`: 27 passed across desktop (1440×1000), tablet (900×1100) and mobile (390×844), including automated accessibility checks, all active detail routes and legacy redirects, search/filter/empty states, keyboard navigation, mixed-language chat, citations, independent histories and existing onboarding links.
- Additional browser coverage in the existing suite checks wide (1920×1080), short laptop (1280×540), short mobile (375×667), and shorter tablet (900×700) screens: full application width, no document overflow, suggestions before/after first send, stable composer, and message-only scrolling.
- Actual screenshots were inspected for each active page layout at desktop/tablet/mobile, including conversation, source expansion, and department/document details. The final identity review checked all active layouts on desktop/mobile/tablet, corrected placeholder contrast, and inspected the gateway mark at 16, 24, 32, 48, 96 and 192 pixels. The shared control-text/control-background pair has a measured contrast ratio of approximately 7:1.

Final sky-identity inspection artifacts are saved under `/workspace/artifacts/masar-sky`: 27 page screenshots (nine layout types × three sizes), three expanded-source conversations, and `logo-sizes.png` showing the small-size identity proof. Run the browser suite to regenerate page screenshots under `/tmp/masar-redesign-*.png` and conversation screenshots in the ignored `frontend/test-results` directory. These are inspection artifacts, not published previews or deployments. Automated accessibility checks do not substitute for a full manual assistive-technology review.

## Assets and runtime boundaries

No dependencies were added. The logo is one small, cacheable local SVG shared by the application and favicon; fonts remain bundled locally. Browser tests verify that the logo URL serves SVG rather than the SPA fallback and that all navigation marks load. The existing page checks also monitor unexpected external requests. All validation is local browser validation; no deployment or external service configuration was performed.
