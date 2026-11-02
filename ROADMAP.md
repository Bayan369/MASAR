# MASAR — Approved implementation roadmap

## Architecture decisions

- Preserve React, TypeScript, Vite and Tailwind CSS on the frontend; Python/FastAPI on the backend; Arabic-first RTL and bilingual technical terminology throughout.
- Use Supabase PostgreSQL as the primary database, pgvector for semantic retrieval, and private Supabase Storage for original documents. Use proper database migrations and Row Level Security (RLS).
- Use Supabase Auth initially. Enforce Employee and Company Admin roles on the backend and in database policies. Keep identity integration extensible to future OpenID Connect SSO without assuming a company's identity provider.
- Use Llama through a configurable hosted inference adapter. Select an Arabic-English capable embedding model before retrieval integration; no model/provider is claimed as selected yet.
- Initial uploads: PDF, DOCX and TXT. No initial Google Drive or SharePoint connectors.
- Do not introduce another database or vector service without technical justification and approval.
- Never invent company documents, employees, statistics or AI answers. Never expose credentials in frontend code, Git or documentation.

## Implementation sequence

Status legend: `[ ]` not started, `[~]` in progress, `[x]` verified complete, `[!]` blocked.

- [x] Phase 1 — Existing foundation reverified and feature branch delivered to GitHub. All 12 browser tests, 2 frontend tests and 6 backend tests passed, together with quality/build checks and live service checks. See PHASE1_PROGRESS.md for evidence.
- [ ] Phase 2 — Persistence and secure access: Supabase schema/migrations, authentication, Employee/Company Admin authorization, RLS, and real profile/department data when supplied. Validate real authentication, unauthorized-access rejection, migrations and data isolation.
- [ ] Phase 3 — Verified company knowledge: private Storage, approved document intake and metadata, ownership, versions, permissions, PDF/DOCX/TXT extraction, knowledge listings and source access. Verify import/update/removal and access controls with approved documents.
- [ ] Phase 4 — Retrieval: Arabic/English chunking, approved multilingual embeddings, pgvector indexes and permission-filtered retrieval. Validate passage relevance, mixed terminology and exclusion of inaccessible/deleted content. No generated answers in this phase.
- [ ] Phase 5 — Grounded AI: hosted Llama adapter, retrieval-backed Arabic-default answers, preserved English terms, citations and insufficient-evidence handling. Verify groundedness, source resolution and integration-failure behavior using actual approved services and documents.
- [ ] Phase 6 — Employee workflows: persistent conversations/history, real profile greeting, department links and source navigation across integrated screens. Validate ownership, privacy and complete employee journeys.
- [ ] Phase 7 — Release readiness: regression tests, manual accessibility review, performance, secure configuration, operational logs, backup/restore checks and deployment documentation. Real deployment requires an approved hosting destination and configuration.

Conduct the full UI/UX and product review after these phases. Continue routine usability/accessibility checks throughout implementation.

## Delivery gates

1. Before starting a phase, verify the previous phase and its relevant tests; do not mark incomplete integrations as working.
2. Maintain phase-specific progress documentation as work proceeds; record evidence and precise blockers.
3. At each phase end, fix failures, update README/progress, commit and push the existing `feat/phase-1-foundation` branch, and verify GitHub delivery.
4. Never merge into main without explicit approval. Do not force-push over remote changes.
5. Stop before an integration requiring credentials, payment, account setup or a major architectural decision. Explain exactly what is needed. Ask before creating Supabase resources or using paid services; architecture approval does not authorize resource creation or spending.
6. Enter credentials only through secure environment configuration. Do not use fake integrations to bypass missing access.

## Next external prerequisite

After the Phase 1 gate succeeds, confirm whether an existing Supabase development project should be used or a new project should be created. New project creation requires explicit approval and selection of organization, region and billing plan. An existing project requires secure configuration and authorization before migrations or Auth/Storage changes are applied. Do not provide secret values in chat.
