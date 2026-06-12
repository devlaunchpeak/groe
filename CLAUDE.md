# **GROE — Claude Code Project Instructions**

This file must be read at the start of every Claude Code session before any work begins. Save this as `CLAUDE.md` in the root of the GROE project folder.

---

## 1\. What This Project Is

GROE is a multi-tenant B2B SaaS platform for **Green Shoe Consulting (GSC)**. It digitizes Steve Shelton's burnout recovery methodology for cybersecurity teams so it can be delivered at scale without Steve's direct involvement in every engagement.

**Build team:** Bon Ishimori (PM/delivery) \+ Kris Faller (build partner), Claude Code-assisted. **CTO:** Nirmal Shah (LaunchPeak Partners) — reviews schema, SSO, and security-critical work. **CEO:** Parth Shah (LaunchPeak Partners) — product sign-offs. **Client:** Steve Shelton \+ Bill Bernard (Green Shoe Consulting). **Phase 1.1 target:** July 6, 2026\.

---

## 2\. Tech Stack (Non-Negotiable)

| Layer | Technology |
| :---- | :---- |
| Framework | Next.js 14+ · TypeScript strict mode · App Router |
| Styling | Tailwind CSS \+ shadcn/ui |
| Database | Supabase · PostgreSQL · Row Level Security · Edge Functions |
| Auth | WorkOS · SAML 2.0 · OIDC · SCIM 2.0 · Magic Link fallback |
| Email | Resend \+ React Email |
| Hosting | Vercel |
| Validation | Zod (all inputs, no exceptions) |
| Charts | Recharts or Tremor |
| Video | Mux OR Cloudflare Stream (decision made at account setup — replace placeholder in Prompt 14\) |

Do not suggest alternative libraries or frameworks. These are locked.

---

## 3\. Design System

Derived from the approved Lovable prototype at [**https://groe-resilience.lovable.app/**](https://groe-resilience.lovable.app/) Recreate all UI from scratch using shadcn/ui \+ Tailwind. Do not reuse prototype code.

### **Colors**

\--color-nav-dark:      \#1C4A2E   /\* sidebar background, deep forest green \*/

\--color-primary:       \#2D6A4F   /\* primary buttons, active states, accent \*/

\--color-primary-light: \#D6EAD8   /\* light green fills, hover states \*/

\--color-bg:            \#F8F6F0   /\* app background, cream \*/

\--color-card:          \#FFFFFF   /\* card backgrounds \*/

\--color-text:          \#111827   /\* primary body text \*/

\--color-muted:         \#6B7280   /\* secondary text, labels \*/

\--color-border:        \#E5E7EB   /\* card borders, dividers \*/

/\* RAG status colors \*/

\--color-red:           \#DC2626   /\* Acute — high burnout \*/

\--color-amber:         \#F59E0B   /\* Developing — moderate \*/

\--color-green:         \#2D6A4F   /\* Resilient — recovered \*/

/\* RAG background fills \*/

\--color-red-bg:        \#FEF2F2

\--color-amber-bg:      \#FFFBEB

\--color-green-bg:      \#F0FDF4

### **Typography**

- **Headings:** Space Grotesk (Google Fonts)  
- **Body:** IBM Plex Sans or Inter  
- **Data/labels:** IBM Plex Mono for scores and numbers

### **Components**

- Cards: white background, `rounded-xl`, subtle `shadow-sm`, `border border-[#E5E7EB]`  
- Buttons (primary): `bg-[#2D6A4F] text-white hover:bg-[#1C4A2E] rounded-lg`  
- Nav sidebar: `bg-[#1C4A2E]` with white text, active item highlighted in `#2D6A4F`  
- H-MTTR gauge: circular arc gauge, 0=resilient (green end), 100=acute (red end), current value displayed large in center  
- RAG badges: colored dot \+ label (e.g. `● Amber — Developing`)  
- Progress bars: green fill `#2D6A4F` on light gray track

---

## 4\. Non-Negotiable Rules

Every one of these applies to every prompt, every session, no exceptions.

### **4.1 Data Isolation**

- **RLS on every table.** Every table with user or org data must have an `org_id` column.  
- RLS policies must enforce that a user from Org A can never read, write, or infer data from Org B.  
- Never bypass RLS. Never use the service role key on the client side.  
- Test: after building any data feature, attempt a cross-org query in Supabase Studio — it must return zero results.

### **4.2 Server-Side Secrets**

- Scoring logic (H-MTTR formula, ARENA algorithm, Critical Distress thresholds) runs **only** in Supabase Edge Functions.  
- Raw video asset IDs are **never** exposed to the client. All video URLs are signed server-side at `/api/video/signed-url`.  
- No proprietary logic in client bundles.

### **4.3 No PII in URLs**

- No user IDs, org IDs, emails, or any identifiable data in URL parameters or query strings.

### **4.4 No Third-Party Analytics**

- No Google Analytics, Mixpanel, Segment, Amplitude, or any external behavioral tracking SDK.  
- First-party metrics only, stored in Supabase.

### **4.5 Audit Log Is Append-Only**

- The `audit_log` table must have a Postgres trigger that raises an exception on any `UPDATE` or `DELETE`.  
- Every sensitive action must call `logAuditEvent()` — see the typed action constants in the audit utility.  
- Never skip audit logging on security-relevant routes to save time.

### **4.6 Magic Link Is Single-Use**

- A used magic link must be invalidated server-side **immediately** on first use.  
- 15-minute TTL enforced server-side, not just UI.  
- Never allow a used link to authenticate a second time.

### **4.7 TypeScript Strict**

- `strict: true` in tsconfig. No `any` types anywhere.  
- All API route inputs validated with Zod schemas before any processing.  
- All Edge Function inputs validated with Zod.

### **4.8 Server Components for Data Fetching**

- Use Next.js App Router server components for all data fetching.  
- No client-side Supabase queries except for real-time subscriptions if explicitly needed.  
- Never fetch sensitive data client-side.

### **4.9 Critical Distress Is Safety-Critical**

- Critical Distress detection and EAP routing **must be enforced server-side**.  
- Never trust client-side state for this decision.  
- If a user's score exceeds the Critical Distress threshold, module access must be blocked at the API level — not just hidden in the UI.  
- The EAP page must show **only** the user's own org's EAP contact. Never another org's data.  
- This feature cannot ship without confirmed thresholds from Steve (OQ-04). Use placeholder `h_mttr > 80` until then.

### **4.10 Org Dashboard Privacy**

- Org dashboards query **only** `org_aggregates`. Never query `assessment_results`, `check_ins`, or any individual-level table for org-level views.  
- If an org has fewer than 20 enrolled users, the org dashboard API must return a suppression flag and **no data whatsoever** — the UI shows a message only.  
- No individual user names, emails, or IDs are ever returned by any org dashboard API route.

---

## 5\. Git Workflow

- After every completed feature, page, or self-contained unit of work: **commit to Git**.  
- Commit message format: `feat: [what was built] — [key files changed]`  
- Branch naming: `feature/[feature-name]` for new work, `fix/[bug-description]` for fixes.  
- Never commit directly to `main`. Work on feature branches, merge via PR.  
- When a task feels done, commit before moving to the next prompt.

---

## 6\. Project File Structure

/app

  /(auth)                    \# Login, magic link, SSO callback

  /(app)                     \# All authenticated routes

    /dashboard               \# IC personal dashboard

    /htmtr                   \# H-MTTR detailed view

    /rag-pathway             \# RAG Pathway screen

    /learning-path           \# My Learning Path

    /learn/\[moduleId\]        \# Module player page

    /assessments             \# Assessment hub

    /progress                \# My Progress

    /settings                \# User settings \+ DSAR

    /org-dashboard           \# Leader/Org Admin org view

    /admin                   \# Org Admin — user management

    /groe-admin              \# GROE Admin — cross-org view

    /orientation             \# New user orientation flow

    /eap                     \# Critical Distress EAP page

/components

  /ui                        \# shadcn/ui base components

  /charts                    \# Recharts/Tremor chart components

  /assessment                \# Assessment-specific components

  /learning                  \# Module and lesson components

  /dashboard                 \# Dashboard-specific components

/lib

  /supabase                  \# Supabase client (server \+ browser)

  /workos                    \# WorkOS auth helpers

  /email                     \# Resend \+ React Email templates

  /validators                \# Zod schemas for all inputs

  /audit                     \# logAuditEvent utility \+ action constants

/supabase

  /migrations                \# SQL migration files (numbered)

  /functions                 \# Edge Functions (scoring engine)

/emails                      \# React Email template files

---

## 7\. Placeholder Values — Replace When Received from Steve

These are intentional stubs. Do not remove them. Do not treat them as final.

| Placeholder | Blocks | Replace when |
| :---- | :---- | :---- |
| H-MTTR formula: `round(((mbi_exhaustion/54)*100 + (mbi_cynicism/30)*100 + ((48-mbi_efficacy)/48)*100 + (100-arena_score)) / 4)` | OQ-01 | Steve provides formula |
| ARENA: 10-question placeholder, 5-point Likert | OQ-02 | Steve provides question set |
| MBI: placeholder question text (22 items) | OQ-03 | MBI license confirmed |
| Critical Distress threshold: `h_mttr_score > 80` | OQ-04 | Steve provides thresholds |
| Top stress signals: empty array `[]` | OQ-06 | Steve provides logic |
| Assessment retake cadence: 30-day default | OQ-07 | Steve provides cadence |

Store all formula weights and thresholds as **named constants at the top of the Edge Function file** so they can be swapped without touching logic.

---

## 8\. Session Start Protocol

At the start of every Claude Code session, Bon will say:

"I am continuing work on the GROE project. Here is where we left off: \[context\]"

When you see this:

1. Read this CLAUDE.md file.  
2. Acknowledge the current state.  
3. Do not re-scaffold or redo previous work.  
4. Continue from where the prompt queue left off.

---

## 9\. Prompt Queue Reference

We are building from a numbered prompt queue (Tab 3 of the sprint plan spreadsheet). Prompts are numbered 0–23. Do not skip ahead. Do not refactor previous prompts' output unless explicitly asked.

Current prompt numbering:

- **Prompt 0:** This file (CLAUDE.md) — you are here.  
- **Prompt 1:** Project scaffold (Next.js \+ Tailwind \+ shadcn/ui \+ env.example)  
- **Prompt 2:** Supabase database schema \+ RLS policies \+ seed data  
- **Prompt 3:** WorkOS auth (SSO \+ magic link \+ middleware)  
- **Prompt 4:** SCIM provisioning/deprovisioning webhook  
- **Prompt 5:** score-hmttr Edge Function (placeholder formula)  
- **Prompt 6:** Audit logging utility \+ append-only trigger  
- **Prompt 7:** Resend email templates (7 templates)  
- **Prompts 8–12:** GROE Admin org provisioning, Org Admin enrollment, orientation, assessment intake, EAP page  
- **Prompts 13–21:** Learning path engine, video delivery, content admin, check-ins, dashboards, progress page, GROE Admin accounts, privacy/notifications  
- **Prompts 22–23:** Bug fix pass, UAT guide generation

---

## 10\. Reference Links

| Resource | URL |
| :---- | :---- |
| Approved UX prototype | [https://groe-resilience.lovable.app/](https://groe-resilience.lovable.app/) |
| Requirements doc (v2) | GROE\_Requirements\_v2 (in project files) |
| Architecture doc (v2) | GROE\_Architecture\_v2 (in project files) |
| Content inventory sheet | [https://docs.google.com/spreadsheets/d/1dDHMv9Mmaay5KspCkheDii7Sl53hgF8lIzO1H\_QpvqM](https://docs.google.com/spreadsheets/d/1dDHMv9Mmaay5KspCkheDii7Sl53hgF8lIzO1H_QpvqM) |
| Next.js docs | [https://nextjs.org/docs](https://nextjs.org/docs) |
| Supabase docs | [https://supabase.com/docs](https://supabase.com/docs) |
| WorkOS docs | [https://workos.com/docs](https://workos.com/docs) |
| shadcn/ui components | [https://ui.shadcn.com](https://ui.shadcn.com) |
| Resend docs | [https://resend.com/docs](https://resend.com/docs) |

