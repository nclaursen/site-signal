# Site Signal backlog

This is a decision backlog, not a feature roadmap. Site Signal exists to answer: **what page should I investigate next, why, and what can the data not prove?**

An item belongs here only if it makes that decision more reliable, makes a deliberate change easier to review, or prevents an avoidable measurement mistake. Everything remains local-first and read-only: Site Signal never publishes or changes a site, analytics property, or external service.

## Product boundary

The MCP owns authenticated source access, normalized evidence, local snapshots, deterministic coverage flags, and explicit user-recorded state. The chat client owns interpretation: query themes, hypotheses, priorities, briefs, and recommendations.

Do not add an MCP feature unless it returns data or durable local state a client cannot reliably recreate from one chat turn. The server must not contain prose recommendations, rewrite advice, generic scores, or hidden LLM reasoning.

## Completed

- **Analytics provider boundary:** GA4, Matomo, and GSC-only setups expose honest provider scope and metric names.
- **Readiness and freshness:** reports expose incomplete coverage, reporting lag, sparse evidence, and maturing pages rather than overstating a conclusion.
- **Flexible comparison windows:** 28–84 day comparisons are available through CLI and MCP.
- **Page investigation evidence:** raw page context, bounded query evidence, and country/device/search-appearance segments are available for a selected URL.
- **Lifecycle and query movement:** multi-window page evidence and bounded entered, exited, and retained query rows are available without calling them complete keyword coverage.
- **Local annotations:** actions, hypotheses, baselines, review dates, and outcome notes can be stored and read locally; no causal lift is claimed.
- **Measurement readiness:** the MCP can expose configured provider-supported outcomes, organic acquisition context, and identifiable AI-referral rows where the provider supports them.
- **Optional implementation context:** a configured local repository and/or sitemap can provide verified page mapping and internal-link candidates. Empty or unmapped results are valid.
- **Release safety:** the public MCP tool contract is documented and covered by a contract test.

## Next local setup — decision-gated

### Configure opt-in repository and sitemap context

**Decision improved:** Can a chat client point to real, verifiable source context when an approved change needs implementing?

**Status:** pending local configuration; no code change is needed.

Set `SITE_SIGNAL_REPOSITORY_PATH` to the site's local repository. Optionally set `SITE_SIGNAL_SITEMAP_URL` once its canonical URL has been confirmed. These values stay in the private environment file, never in Git.

**Done when:** `get_repository_context` maps a known page to its actual source file, and `get_internal_link_context` returns only traceable candidates.

### Configure outcome events only when they are meaningful

**Decision improved:** Can the site distinguish search visibility from a measurable business outcome?

**Status:** pending a user decision about the real GA4 event names.

Set `GA4_OUTCOME_EVENT_NAMES` only for events that represent a meaningful outcome, such as a confirmed lead or sign-up. Counts remain property-level and are never attributed to individual GSC queries.

**Done when:** `get_measurement_readiness` can report configured outcome coverage without inventing attribution.

## Candidate data primitives — build only when a real decision needs them

### Snapshot annotations beyond editorial actions

Store user-supplied deployment, tracking, or campaign annotations against a snapshot window. This would help a client show known context alongside observed movement without claiming that the annotation caused the change.

### Bounded URL inventory evidence

Return a small, explicit inventory of pages from a configured sitemap or repository, including mapping confidence and gaps. This would support answering “what is covered?” without expanding into a crawler or a hosted dashboard.

### Configured business-outcome trend snapshots

Persist comparable property-level outcome counts across snapshots for configured events. This would make measurement review more durable while preserving the boundary that GSC queries are not conversion-attributed.

## Explicitly not building

- Hosted dashboards, scheduled alerts, user accounts, or subscription rank tracking.
- Competitor crawling or SERP scraping.
- Automatic rewrites, metadata changes, internal-link insertion, commits, or publishing.
- Generic SEO, AEO, GEO, or AI-visibility scores.
- Attribution claims from GSC queries to visits, sessions, or conversions.

## Before starting any item

State the real decision it supports, who makes that decision, and what evidence would justify keeping it. If the current MCP response can answer the question with a small workflow or documentation change, prefer that over another feature.
