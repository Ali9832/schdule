# Molibden changelog

Version format follows Semantic Versioning: MAJOR.MINOR.PATCH.

## [1.1.1] - 2026-10-23

### Fixed
- Restored the Molibden 1.1 application from b9b7f64 after the accidental replacement with the older NOVA ZIP (restoration commit: 47d7a25).
- Restored Persian calendar, account authentication, responsive UI, Vercel integration, and the reviewed bank of 3,248 items in 65 categories across 10 domains.

### Changed
- Unified application and API version numbers using package.json.
- Displayed the version in the page header and exposed version and deployment commit through /api/health and /api/release.
- Added QA checks for matching package, lockfile, UI, changelog and service worker versions.

### Pending
- Startup performance changes previously made on the obsolete NOVA snapshot have not been reapplied to Molibden yet.

## [1.1.0]

- Existing Molibden baseline at b9b7f64: calendar, authentication, reviewed categories and PostgreSQL configuration.
