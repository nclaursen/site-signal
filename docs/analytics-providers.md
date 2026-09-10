# Analytics-provider implementation notes

This document records Site Signal's first-class analytics-provider design without turning it into a multi-tenant or hosted service.

## Operating model

One Site Signal process serves one named site profile:

| MCP entry | Example analytics provider | Private state directory |
| --- | --- | --- |
| `site-signal-niels` | GA4 | `~/.site-signal/niels` |
| `site-signal-umbraco` | Matomo | `~/.site-signal/umbraco` |

Both entries run the same published CLI/MCP package. Each has its own local environment file and data directory. A profile must never share a snapshot database with another profile: the current snapshot identifier is period-based, so shared state could otherwise mix sites.

This is deliberately **not** one MCP server that switches site at tool-call time. A caller chooses the named MCP server before it asks for data. Every response also states its `profile`, `site`, and `analyticsProvider`.

## Provider boundary

Keep GSC in the shared search adapter. Replace the GA4-specific `ga()` call with an `AnalyticsProvider` selected at startup.

```ts
type AnalyticsProviderName = 'ga4' | 'matomo' | 'none';

type AnalyticsEvidence = {
  provider: AnalyticsProviderName;
  metricLabels: Record<string, string>;
  rows: AnalyticsRow[];
  coverage: { complete: boolean; limitations: string[] };
};

type AnalyticsRow = {
  url: string;
  acquisition: { type: string; value: string } | null;
  metrics: Record<string, number>;
};

interface AnalyticsProvider {
  name: AnalyticsProviderName;
  capabilities(): string[];
  landingEvidence(period: Period): Promise<AnalyticsEvidence>;
}
```

The internal format is intentionally narrow. It supports page context and reports without pretending that different products share identical semantics. Human-facing output must use each provider's original metric labels: for example, a Matomo `visit` must never be displayed as a GA4 `session`.

`none` is a valid provider. It returns no analytics rows plus a clear `analytics not configured` limitation; GSC opportunity discovery remains available.

## Configuration

The public package uses provider selection and profile isolation. All values below are local-only and must stay in a private environment file.

```env
SITE_SIGNAL_PROFILE=niels
SITE_SIGNAL_DATA_DIR=/absolute/path/to/private/site-signal/niels
ANALYTICS_PROVIDER=ga4
GA4_PROPERTY_ID=123456789

# Or, for another Site Signal MCP entry:
SITE_SIGNAL_PROFILE=umbraco
SITE_SIGNAL_DATA_DIR=/absolute/path/to/private/site-signal/umbraco
ANALYTICS_PROVIDER=matomo
MATOMO_URL=https://analytics.example.com/
MATOMO_SITE_ID=1
MATOMO_TOKEN_AUTH=replace-with-read-only-token
```

GSC configuration remains per profile. The Matomo URL must be an HTTPS base URL, and the connector should use only the reporting endpoints needed for read operations.

## Implementation status

Completed:

1. Provider/profile configuration validation and `profile` plus `analyticsProvider` in snapshots, reports, page context, MCP status, and MCP tool responses.
2. Existing GA4 acquisition data extracted behind the provider interface.
3. A `none` provider for explicit GSC-only operation.
4. Matomo's read-only Reporting API adapter using `Actions.getPageUrls` and `Referrers.getReferrerType`.
5. Generic analytics evidence and provider-specific metric labels in service output.

Still to validate against a real Matomo instance:

1. Confirm exact returned fields, URL shape, timezone, pagination, and permission behaviour.
2. Capture token-free integration fixtures from a consented test site.

Candidate selection remains GSC-led in this phase. Analytics data provides acquisition and outcome context; it does not create a blended ranking score.

## Matomo live-test checklist

Use a real, non-production-sensitive profile and a read-only token. Before treating any Matomo field as product contract, verify:

1. The server URL, `idSite`, and token can call the Reporting API.
2. A fixed 28-day range returns page URL rows from `Actions.getPageUrls`.
3. Returned page URLs can be normalized against the site's GSC URLs without losing meaningful query parameters.
4. Referrer/organic context is available at a usable scope. Record whether it can be returned per page, per segment, or only as a separate site-level report.
5. Available goal/outcome data can be read without requesting write permissions. If not configured, return an explicit unavailable capability.
6. Pagination, row limits, timezone, sampling/aggregation, and delayed-data behaviour are represented in `coverage.limitations`.
7. The MCP response identifies `profile: umbraco` and `analyticsProvider: matomo` on every relevant tool response.

Do not add support for optional Matomo modules (including AI-referrer reporting) until their availability and permission requirements have been confirmed on the target instance.
