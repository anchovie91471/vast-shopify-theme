# Changelog

All notable changes to VAST are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changes prior to 1.2.0 are documented in the git history.

## [1.2.0] — 2026-04-21

### Changed

- Default `npm run dev` no longer uses `--theme-editor-sync` (matches Shopify
  CLI's own default). Run `npm run dev:sync` for round-trip behavior, or
  `shopify theme pull` to capture theme-editor changes manually. The old
  default silently round-tripped theme-editor experiments into the local
  working tree, which surprised CLI-push developers who treat their repo as
  the source of truth.
- Setup wizard now asks about deployment strategy (Shopify CLI push /
  GitHub integration / Not sure yet) and configures `.gitignore` and the
  recommended dev script to match. Mutations use a marker-delimited managed
  block (`# >>> VAST setup: gitignore block <<<` / `# >>> end VAST setup <<<`)
  so reruns are idempotent — you can switch deployment strategies at any time
  by rerunning the wizard.

### Added

- `npm run dev:sync` and `npm run dev:vite-server:sync` script variants that
  keep `--theme-editor-sync` enabled for users who want theme-editor changes
  to flow back into their working tree (typical for GitHub-integration
  deployments).
- README "Dev Workflow" section explaining the two scripts, what theme-editor
  edits actually modify (`templates/*.json`, `config/settings_data.json`), and
  what lives outside the theme (metafields, metaobjects, products, blog posts,
  customers).

### Dependencies

- Bumped `@anchovie/schematic` from 2.2.1 to 2.2.6.
