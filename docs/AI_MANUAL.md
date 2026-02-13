# FaithFlow AI Manual

This guide explains how the AI layer works in FaithFlow AI today, how it is governed (RBAC, entitlements, audit), and how to extend it safely. It is written for both developers and early adopters.

## 1) What AI Does (Current Scope)

- **Admin assistant ("Ask FaithFlow")**: staff-only Q&A over tenant data with citations and audit logging.
- **Starter insights**: quick operational metrics (attendance, giving, volunteer gaps) for the last 30 days.
- **Interaction history**: recent questions/answers are stored per tenant.

Where it lives:

- Admin UI: `apps/admin/src/app/ai/page.tsx`
- API router: `packages/api/src/router/ai.ts`
- AI provider wrapper (Vercel AI SDK): `packages/ai/src/index.ts`

## 2) Access Control + Governance

FaithFlow treats AI like an operational tool, not a consumer chatbot.

- **Staff-only**: the API requires a matching `StaffMembership` for the requesting Clerk user.
- **Plan entitlement**: feature key `ai_insights` must be enabled for the tenant plan.
- **Read-only lockout**: if the tenant is in `inactive_subscription` mode, AI reads can load (insights/history), but asking questions (a write) is blocked.
- **Audit trail**: each AI interaction records:
  - `AiInteraction` row (question, answer, sources)
  - `AuditLog` event (`ai.ask`) with provider/model metadata
 - **RBAC (beta-safe)**:
   - Staff can use Ask FaithFlow.
   - Finance-linked sources (donation record lookups and giving sum details) are only included for `ADMIN` staff.

## 3) Data Sources + Citations

The assistant is tenant-scoped and uses a small, explicit "sources" list assembled server-side. The prompt instructs the model to:

- only use provided sources
- cite sources inline as `[S#]`
- say what is missing if sources are insufficient

Current sources (see `collectSources(...)` in `packages/api/src/router/ai.ts`):

- **Metrics**:
  - total members
  - upcoming events
  - giving (last 30 days; staff sees counts, admins also see sum)
- **Light keyword lookups** (best-effort, single-token):
  - member name matches
  - completed donation matches by donor name/email (admins only; limited)
  - event title matches

Important note:

- FaithFlow intentionally avoids feeding raw PII into prompts by filtering query tokens that look like emails or phone numbers.
- Source labels redact email-like strings; deeper redaction is tracked as a follow-up.
- This is not a vector database / RAG system yet; it's a governed, structured "sources list" approach.

## 4) AI Providers + Runtime Configuration

FaithFlow uses the Vercel AI SDK for a thin provider abstraction:

- Providers: OpenAI, Anthropic, Google (Gemini)
- Default models can be overridden via env vars

Required env vars (set values in your `.env.local` / Render/Vercel env UI; do not commit secrets):

- `OPENAI_API_KEY` (optional if not using OpenAI)
- `ANTHROPIC_API_KEY` (optional if not using Anthropic)
- `GOOGLE_GENERATIVE_AI_API_KEY` (optional if not using Google)

Optional model overrides:

- `AI_OPENAI_MODEL` (default: `gpt-4o-mini`)
- `AI_ANTHROPIC_MODEL` (default: `claude-3-5-sonnet-latest`)
- `AI_GOOGLE_MODEL` (default: `gemini-1.5-pro`)

## 5) Key API Surface

tRPC procedures (router: `ai`):

- `ai.starterInsights` (query): returns operational stats (tenant-scoped; optional `churchId`)
- `ai.recent` (query): returns recent `AiInteraction` rows for the tenant
- `ai.ask` (mutation): generates an answer and persists `AiInteraction` + audit log

## 6) Operational Expectations (Beta)

- AI should never silently fabricate internal data. If the answer cannot be supported by sources, it should explicitly say so.
- AI responses should be **traceable** (sources) and **auditable** (stored + audit events).
- AI should degrade gracefully when a provider key is missing (return a clear error; do not partially succeed).

## 7) Extending AI Safely (Recommended Pattern)

When adding a new AI feature, keep the same structure:

1. Add/confirm a plan feature key (e.g., `ai_care_summaries`) and gate reads/writes appropriately.
2. Add a server-side source collector that produces a small list of facts with stable IDs + timestamps.
3. Keep prompts deterministic and short; always require citations for factual claims.
4. Persist output + sources, and write an audit event.
5. Add UI affordances for:
   - loading/error states
   - read-only mode behavior
   - "copy answer" + link to sources (future)

If you later introduce a vector store:

- store embeddings per tenant
- scope retrieval by tenant + church/campus where applicable
- add a redaction layer before embedding or prompting

## 8) Known Gaps (Next Iteration)

- **Redaction depth**: current token filtering is minimal; add structured redaction for sensitive fields (emails, phone numbers, addresses, notes).
- **Human review**: for AI-generated outbound comms, add an approval UI and store the approved prompt/output.
- **Rate limiting**: add per-tenant and per-user throttles to avoid runaway spend.
- **Evaluation**: add "thumbs up/down" + incident reporting on AI answers.
