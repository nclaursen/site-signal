# Site Signal backlog

This is a decision backlog, not a feature roadmap. Site Signal exists to answer: **what page should I investigate next, why, and what can the data not prove?**

An item is eligible only if it makes that decision more reliable, makes the resulting change easier to review, or prevents an avoidable measurement mistake. Every item must stay local-first and must not publish or change a site, analytics property, or external service.

## Product guardrails

- Prefer fewer, evidence-backed investigations over a long ranked list.
- Keep GSC search evidence, analytics-provider evidence, and editorial judgement explicitly separate.
- Make uncertainty visible rather than converting it into a score.
- Produce an inspectable local artefact; do not require a hosted dashboard.
- A user must remain the decision-maker and implementer.

## Now — make the data layer portable and safe to act on

### 1. First-class analytics providers (GA4 and Matomo)

**Decision improved:** Can Site Signal be used against the analytics system the site actually uses?

Keep GSC as the shared search-performance source, but replace the GA4-specific acquisition path with a small analytics-provider boundary. Implement GA4 and Matomo as equal, documented providers. The selected provider must power the entire pipeline: sync, local snapshots, page context, candidate reports, CLI, and MCP—not a separate “Matomo mode” or one-off export.

Normalize only concepts that can be stated honestly across providers: page URL, reporting period, acquisition/referrer context, visits/sessions, engagement-quality metrics where available, and configured outcomes where available. Preserve the provider's original metric names and source scope in all output: a Matomo visit is not a GA4 session. GSC queries remain separate from analytics outcomes.

The public package should configure this through a provider selection and provider-specific local credentials. Credentials, tokens, snapshots, and reports remain outside the repository. GSC-only must remain a supported, explicit configuration when no analytics source is available. One running MCP server represents exactly one named site profile; two sites run as two server entries with separate environment files and data directories.

**Done when:** a GA4 or Matomo configuration produces the same core Site Signal artefacts and MCP tool responses; each response declares its provider, source scope, metric names, coverage, and unavailable capabilities.

**Compatibility gate:** validate the Matomo implementation against the ordinary Reporting API data that a real instance exposes: page URL reports, referrer/organic context, and goals where configured. Optional Matomo modules must enhance output only when present, never become a requirement.

The implementation contract and live-test checklist are in [docs/analytics-providers.md](docs/analytics-providers.md).

### 2. Snapshot coverage and freshness states

**Decision improved:** Can I trust this comparison enough to spend time investigating it?

The current report records GSC truncation, but it does not make every coverage limitation or data freshness condition prominent in the candidate output. Add clear states such as `ready`, `incomplete coverage`, `too fresh`, and `insufficient evidence`, with the reason beside every affected recommendation. Include GSC row-cap status, analytics-provider coverage, configured reporting lag, and the snapshot's creation time.

**Done when:** a report cannot present a candidate as decision-ready when the underlying comparison is incomplete or prematurely fresh; JSON exposes the same machine-readable reasons.

**Why first:** better recommendations are useless if the tool cannot disclose when its evidence is partial.

### 3. Longer-window and new-page safeguards

**Decision improved:** Is this movement meaningful, or ordinary noise / a page that has not matured yet?

Offer an explicit 84-day comparison alongside the existing equivalent 28-day periods. Add a `maturing` state for pages without a meaningful prior baseline. Do not blend the windows into a magic score; show both and explain when they disagree.

**Done when:** the user can request a longer comparison and reports label new or low-evidence pages without implying a performance conclusion.

**Build only if:** initial use shows that 28-day reports repeatedly surface changes that cannot be assessed from that window alone.

## Next — turn a signal into a reviewable investigation

### 4. Decision-ready page evidence brief

**Decision improved:** What should I inspect on this page before I propose a change?

Turn the existing raw `page` context into a compact local Markdown/JSON brief: period deltas, bounded query examples, analytics-provider acquisition rows, coverage limitations, and a checklist for intent, SERP position, reader need, and implementation context. It must not prescribe a rewrite or claim that a query caused a visit, session, or conversion.

**Done when:** one command produces an artefact a marketer or editor can review without manually stitching together several JSON blocks.

**Why before crawling:** it validates that the existing signal is useful before adding a larger page-inventory surface.

### 5. Action and review log

**Decision improved:** Did we learn something from a deliberate change, and what should we revisit?

Use the already-created local `actions` table to record a proposed change, hypothesis, linked baseline snapshot, implementation date, review date, status, and outcome notes. Reports should surface actions due for review, but never calculate or claim causal lift.

**Done when:** an action is created and updated locally through CLI/MCP, and its baseline and review context can be retrieved in a report.

**Build only if:** the evidence brief leads to recurring manual changes; otherwise this is process overhead.

## Later — add context only where it changes the next action

### 6. Bounded page and internal-link evidence

**Decision improved:** Is an internal-link or on-page context change worth considering for this page?

Start with a deliberately small, verifiable inventory: a supplied sitemap and/or a local repository, plus bounded extraction of a selected live page. Return only links that can be verified in that inventory, including source URL/file and anchor context. No broad crawl and no generic link-opportunity score.

**Done when:** a suggested link can be traced to real source context, and an empty result is an acceptable outcome.

**Build only if:** repeated briefs identify internal linking as the real blocker, rather than title, content, or intent.

### 7. Measurement-readiness audit

**Decision improved:** Can this site measure the outcome it says it cares about?

Show provider-supported configured outcomes, organic-source definitions, identifiable AI-referral rows, and the gaps that make those views unreliable. Keep these as separate measurement lenses—not an “AI visibility” metric—and never infer untracked conversions.

**Done when:** the output distinguishes Google Organic, all organic, and identifiable AI referrals, and names missing configuration or coverage.

**Build only if:** the site's editorial decisions depend on conversion or referral outcomes rather than search demand alone.

### 8. Optional repository mapping and implementation handoff

**Decision improved:** Where would an approved change be made, and what should the implementer receive?

Map a verified URL to a source file only when the user supplies or configures a local repository. Generate an implementation brief with evidence and open questions. Never edit, commit, or publish the file.

**Done when:** each mapping is explicit and verifiable; unmapped URLs remain unmapped rather than guessed.

**Build only if:** the same team repeatedly loses time finding the correct content source after a decision is already approved.

## Explicitly not building

- Hosted dashboards, scheduled alerts, user accounts, or subscription rank tracking.
- Competitor crawling or SERP scraping.
- Automatic content rewrites, title changes, internal-link insertion, commits, or publishing.
- A generic SEO, AEO, GEO, or AI-visibility score.
- Attribution claims between GSC queries and analytics visits, sessions, or conversions.

These either create false precision, expand Site Signal into a platform, or remove the human review step that the tool is designed to support.

## Before starting any item

Write down the real decision it supports, the user who will make that decision, and the evidence that would make the item worth keeping. If the current CLI/report can answer the question with a small documentation or workflow change, do that instead of adding a feature.
