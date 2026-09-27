# Phase 21 — production canvas globe

Date: 2026-09-25. Saved in Gov-view folder. No founder approval or public listing.

## Work completed

- Added a CSP-safe canvas globe for production, using bundled Natural Earth country boundaries and pilot subdivision boundaries. Development keeps Cesium. No imagery service is required.
- Globe shows jurisdiction counts and published venue pins, supports drag and zoom, and offers an accessible place menu. Globe clicks select a jurisdiction and update shareable public URL state. Country selector, list and details remain available if globe loading fails.
- Added pure orthographic projection, inverse hit testing and antimeridian-aware bounds. Map aggregates still count distinct application cycles, not venues.

## Verification

- Production build, TypeScript phase, secure export and `git diff --check` passed. Export contained 1,790 files and 28.2 MiB, with no detected secrets.
- Six focused orthographic and public-view tests passed.
- In-app browser displayed globe, country boundaries and count markers under production CSP. Selecting Brazil marker set `country=BR`, moved camera and reduced demo list to two cycles. Japan demo detail remained selected for inspection. No reviewed opportunities were published.

## Remaining gates

- Founder review of staged source packets, independent worldwide coverage audit and keyboard/screen-reader acceptance checks remain before public launch.
