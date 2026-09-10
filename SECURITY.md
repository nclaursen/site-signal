# Security and privacy

Site Signal is local-first. OAuth tokens, cached data, reports, and action logs are stored under `~/.site-signal` by default (or `SITE_SIGNAL_DATA_DIR`) and are never sent anywhere except Google APIs requested by the user.

The tool requests only `webmasters.readonly` and `analytics.readonly` scopes. It never changes a website, analytics configuration, or an external business system. Do not commit `.env`, token files, snapshots, or reports. Report vulnerabilities privately through GitHub Security Advisories when the repository is published.
