# MASAR workspace redesign

## Audit and scope

The active application is `App.tsx` → `Demo.tsx` → `PlatformPages.tsx`. It includes the employee home, seven department detail pages, the onboarding guide, three procedures, thirteen documents and their reading pages, Ask Masar, and missing-page states. Bookmarked `/demo` routes redirect to the same application.

The old global `styles.css` was loaded alongside a second stylesheet with accumulated overrides, repeated viewport sizing, competing minimum heights, and multiple card treatments. The redesign replaces the active styling entry point rather than adding another override layer. The old file and inactive components remain in the repository; they are no longer loaded by the active application.

There is no active profile/settings route or standalone interactive task/checklist page in this branch. The previous account-dependent implementation in `pages/WorkspacePages.tsx` is not mounted by `App.tsx`. This design-only change does not activate those features, add authentication, or create task state. The existing onboarding steps remain available and unchanged.

## Design foundations

- `frontend/src/design/tokens.css`: semantic color, typography, spacing, radius, focus, navigation, and page-gutter tokens. Pine anchors navigation and actions; brass is a restrained, accessible accent; warm neutral surfaces carry content.
- `frontend/src/design/foundation.css`: one reset, local Arabic typography, accessible keyboard focus, skip navigation, and reduced-motion preferences.
- `frontend/src/design/Primitives.tsx`: reusable page headers, search fields, and searchable-list empty states. Existing Lucide icon primitives provide consistent department identities.
- `frontend/src/demo/demo.css`: a single ordered stylesheet for the shell, shared controls, page-specific layouts, and responsive rules. Spacing uses the shared 4px scale. Logical borders, padding, and alignment preserve RTL.

## Page patterns

| Surface | Layout and purpose |
| --- | --- |
| Shell | Compact pine navigation, restrained current-page indicator, white utility header, full application canvas. Mobile navigation remains keyboard operable. |
| Employee home | Editorial welcome and actions, first-day sequence, open destination columns, company/department reference links. No fake metrics or activity feed. |
| Department directory | Searchable two-column records on desktop and single-column entries on mobile; distinct icons, readable names, service summaries and clear destination links. |
| Department details | Responsibility and service sections separated by spacing; a compact contact context panel; direct source link. |
| Onboarding and procedures | Numbered reading paths with a continuous sequence; related departments and assistant actions use a supporting column on wide screens. |
| Document library | Search and category controls above aligned document records; metadata stays secondary; rows reflow on mobile. |
| Document reader | Readable text measure and larger body typography; supporting contents/metadata column; stacked on mobile. |
| Ask Masar | Viewport-sized application canvas, one message scroller, stable composer. Assistant answers are unboxed; user turns have quiet backgrounds. Evidence expands inline with direct source links. Existing welcome suggestions disappear after the first turn. |
| Empty/missing/status | Consistent shared typography, icons, spacing, focus and recovery actions; existing verified/uncertain/unavailable and typing states preserved. |

No catalog, assistant intent, message lifecycle, API, authentication, secrets or Supabase behavior changes are included.

## Validation

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`: passed, 32 unit tests.
- `npm run build`: passed.
- `npm run test:e2e`: 21 passed across desktop (1440×1000), tablet (900×1100) and mobile (390×844), including automated accessibility checks, all active detail routes and legacy redirects, search/filter/empty states, keyboard navigation, mixed-language chat, citations, independent histories and existing onboarding links.
- Additional browser coverage in the existing suite checks wide (1920×1080), short laptop (1280×540), short mobile (375×667), and shorter tablet (900×700) screens: full application width, no document overflow, suggestions before/after first send, stable composer, and message-only scrolling.
- Actual screenshots were inspected for each active page layout at desktop/tablet/mobile, including conversation, source expansion, and department/document details. The initial brass text contrast and long English department marks were corrected before the passing run.

Run the browser suite to regenerate page screenshots under `/tmp/masar-redesign-*.png` and conversation screenshots in the ignored `frontend/test-results` directory. These are inspection artifacts, not published previews or deployments. Automated accessibility checks do not substitute for a full manual assistive-technology review.
