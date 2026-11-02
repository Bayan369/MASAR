# Production decisions

- Supabase Auth verifies bearer identity through the authenticated `/auth/v1/user` endpoint. FastAPI reads active membership via the caller's RLS-protected PostgREST connection; it never trusts profile/tenant/role from request bodies or user_metadata.
- User reads, directory changes and conversation CRUD use the user's token and RLS. Privileged writes use service-only SQL RPCs which revalidate the verified actor and tenant within the transaction. A service key is never a browser credential.
- Documents are queued durably in the existing documents table. A separate portable worker claims leases, extracts bounded text in a restricted subprocess, computes multilingual BGE-M3 embeddings via Workers AI, and atomically publishes chunks. No new database, vector service or paid queue.
- PDF, DOCX and UTF-8 TXT only; 5MB upload, 100 pages, 100k extracted characters, at most 80 chunks. Reject encrypted/scanned empty PDFs, unsafe DOCX archives and duplicate company content. OCR is not implemented; report it explicitly.
- `@cf/baai/bge-m3`, 1024 dimensions, cosine pgvector retrieval. Cloudflare Free confirmation and error halting remain; no paid fallback. Lexical mode is an explicit operator option, never a silent provider-error fallback.
- Llama generates answers and selects evidence IDs; the server slices exact original excerpts. Production never reads packaged demo documents. Conversation turns are atomically persisted after generation with a request UUID for replay safety.
- Admins cannot read employee conversations. Stored assistant messages with citations no longer accessible to the owner are hidden by RLS. Documents are archived before object deletion to revoke access immediately.
- No open company signup or client-controlled membership. Bootstrap the initial company/admin via an operator CLI after deployment approval; existing admins can invite colleagues through guarded backend operations.
