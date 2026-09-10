# Site Signal

**A local-first Google Search Console + GA4 content-opportunity CLI and stdio MCP server.**

Site Signal helps answer a deliberately narrow question: *which pages are worth investigating next, what changed, and what can the data not prove?* It saves reports and snapshots locally, uses no model API, and never changes a website or analytics property.

## What it does

- Fetches finalized GSC page performance for two equivalent 28-day periods.
- Shows bounded, side-by-side GSC query examples for a selected page and highlights observed movement.
- Fetches GA4 landing-page/session-source rows separately.
- Normalizes URLs before comparing sources; retains the underlying source scope.
- Creates a deterministic local Markdown + JSON report of review-gated changes.
- Exposes local status, opportunity discovery, and report generation over stdio MCP.

## What it does **not** do

- Publish content, change tags/events, or send data to a third party.
- Claim GSC clicks equal GA4 sessions, or attribute a query to a session/conversion.
- Reconstruct complete GSC query coverage from top rows.
- Call an LLM, crawl competitors, or sell an “AI visibility score.”

## Install

Requires Node.js 20+.

Clone the repository and run it locally:

```sh
git clone https://github.com/nclaursen/site-signal.git
cd site-signal
npm install
cp .env.example .env
npm run build
npm link
```

After the first npm release, `npm install -g site-signal` will also be supported.

## Configure Google access

1. In a Google Cloud project, enable **Google Search Console API** and **Google Analytics Data API**.
2. Configure the OAuth consent screen; if it is External and in testing, add yourself as a test user.
3. Create an OAuth client of type **Desktop app**.
4. Put its values and your site settings in a local `.env`:

```env
SITE_DOMAIN=example.com
GSC_PROPERTY=sc-domain:example.com
GA4_PROPERTY_ID=123456789
GOOGLE_OAUTH_CLIENT_ID=1234567890-example.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=replace-me
```

`GA4_PROPERTY_ID` is the numeric reporting property ID, **not** a `G-...` Measurement ID. Tokens, cache, SQLite database, and reports default to `~/.site-signal`, outside your repository.

```sh
site-signal auth
site-signal doctor
site-signal sync
site-signal report
```

The OAuth flow requests only `webmasters.readonly` and `analytics.readonly`. GSC dates use Pacific time; GA4 uses the property timezone.

## Demo and MCP

Run `site-signal demo` for a synthetic output example—no credentials required. See [fixtures/demo-report.md](fixtures/demo-report.md).

For a local MCP host, run:

```sh
site-signal mcp
```

The MCP tools are `get_site_status`, `find_content_opportunities`, `get_page_context`, and `generate_local_report`.

## Interpretation rules

The report returns fewer opportunities when data is sparse. Current gates require at least 100 impressions in either comparison period. Use `site-signal page https://example.com/page/` to inspect the selected page's current and prior query examples. Query evidence is illustrative, not a complete total: the GSC API returns top rows and may withhold low-volume data. High impressions plus low CTR is not automatically a title problem. Before changing a page, inspect the query mix, position, reader intent, and implementation context.

## Privacy and security

Read [SECURITY.md](SECURITY.md). Never commit `.env`, `~/.site-signal`, report files, or OAuth tokens.

## Licence

[MIT](LICENSE).
