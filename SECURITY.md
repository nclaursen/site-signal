# Security and privacy

Site Signal is local-first. OAuth tokens, Matomo tokens, cached data, reports, and action logs are stored under `~/.site-signal` by default (or `SITE_SIGNAL_DATA_DIR`) and are never sent anywhere except the configured Google APIs and Matomo Reporting API.

The tool always requests only `webmasters.readonly`; it requests `analytics.readonly` only when the selected analytics provider is GA4. Matomo credentials are used only for read-only Reporting API requests. It never changes a website, analytics configuration, or an external business system. Do not commit `.env`, token files, snapshots, or reports. Report vulnerabilities privately through GitHub Security Advisories when the repository is published.
