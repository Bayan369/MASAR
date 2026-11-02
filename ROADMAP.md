# MASAR implementation phases

The approved product-completion request supersedes the earlier deadline-demo scope. Existing Foundation migrations and demo evidence safeguards are preserved. See PRODUCT_PROGRESS.md for the current gate and docs/VALIDATION.md for measured results.

| Phase | Local implementation | External acceptance gate |
| --- | --- | --- |
| 1 Foundation / Arabic RTL | Existing identity retained; authenticated screens completed | User visual/product review |
| 2 Auth / database | Supabase session flow, verified backend identity, roles, five migrations and tenant RLS tests | Apply reviewed migrations; configure Auth; live two-company checks |
| 3 Documents | Admin upload/ACL/delete/retry, private Storage policies, durable worker, bounded PDF/DOCX/TXT processing | Storage gateway + real approved document upload/processing |
| 4 Retrieval | BGE-M3 embeddings + pgvector/lexical permission-filtered search | Actual embeddings and bilingual relevance benchmark |
| 5 AI grounding | Existing Workers AI Llama adapter, exact evidence IDs/excerpts, provider error/quota stops | Actual Free-account inference against approved documents |
| 6 Employee workflows | Own conversation persistence/recovery/history, sources, company/departments/profile/admin UI | Real Auth-to-document-to-answer acceptance run |
| 7 Release readiness | Local regression/browser/RLS tests, production builds, containers, CI and deployment instructions | Configure hosting/TLS/backups/alerts; live checks; deployment by owner |

No phase is represented as fully live accepted while its external gate remains unverified. No hosted SQL, deployments, paid services or merge into main are authorized by these local deliverables. All delivery remains on `feat/phase-1-foundation`.
