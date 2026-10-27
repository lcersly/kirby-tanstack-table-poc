# Kirby table integration research

**Checked:** 2026-10-27
**Scope:** Public Kirby releases and source relevant to a desktop Payments-tab table in this public personal POC.
**Conclusion:** The requested premise is not established by the public Kirby package or source: no Kirby release or preview was found that integrates TanStack Table v9. Kirby's documented implementation is a styled native HTML table with a small sortable-header component, not a table engine.

## Findings

### Package, release, and channel

The public package `@kirbydesign/designsystem` is published to npm. At the time checked, `12.0.0` was the `latest` tag; the registry also exposed `11.10.0-rc.0` as `next`, `11.11.0-dev-9d936c8` as `dev`, and `11.3.1-8822decb1` as `pr`. The public registry metadata contains 928 versions. No TanStack dependency was present in the inspected package metadata, and searches of published-version descriptions/keywords and the public Kirby repository found no TanStack Table integration.

The actual Angular adapter for TanStack Table v9 is a separate package, `@tanstack/angular-table` (`9.3.1` was the `latest` version checked). It is not a Kirby package and is not listed as a dependency or peer dependency of Kirby. Treating it as Kirby's table would misstate the integration contract.

### Kirby's current table API

Kirby's migration guide says that `TableComponent` and `TableRowComponent` were removed in favor of the `kirby-table` CSS class, and that the deprecated `DataTableModule` is replaced by the standalone `TableSortableComponent`.

The source for `TableSortableComponent` shows a standalone component with selector `th[sortable]`, using Kirby's icon component. Its inputs are `sortable`, `active`, `sortDirection`, `iconAlignment`, and `alignment`. It decorates a normal HTML table header; it does not define columns or rows, nor implement sorting or a data model.

This supports Kirby table styling and a sort-indicator affordance. It does not provide table-engine features such as sorting/filtering state, pagination, row selection, column visibility, grouping, pinning, or virtualization. Those capabilities are not established by this Kirby API. The research does not establish whether other Kirby components prevent using Kirby for the rest of the Payments tab.

### Angular and dependency compatibility

The published `@kirbydesign/designsystem@12.0.0` metadata declares Angular `^21.0.0 || ^22.0.0` peer ranges for `@angular/core`, `common`, `forms`, `router`, `animations`, and `@angular/cdk`. It also declares `@ionic/angular: 9.0.5`, `rxjs: ^7.0.0`, and `@kirbydesign/core: ^0.0.96`, among other peers. Its only listed runtime dependency is `tslib: ^2.3.0`. There is no `@tanstack/*` dependency or peer dependency.

`@kirbydesign/extensions-angular@6.0.0` declares the same Angular 21/22 range and a peer on `@kirbydesign/designsystem: ^12.0.0`; its listed runtime dependency is `tslib: ^2.3.0`. Its npm metadata has no `license` field. Do not rely on that package in the public POC until the scope of the repository's MIT license for its source directory is confirmed.

These are the peer requirements of the latest core package checked, not evidence that it supplies the requested TanStack integration. Earlier versions and previews likewise did not surface such an integration in the registry metadata or public source/issue searches performed for this research.

### Public use and licensing

The core `@kirbydesign/designsystem` package metadata and the public `kirbydesign/designsystem` repository identify the license as MIT. Its public npm distribution and source can therefore be considered for this public repository and browser bundle under the MIT license terms, including its notice and warranty conditions. No package-specific restriction against that use was found in the public sources checked.

The TanStack Angular adapter is also published separately under MIT, but using it would be a distinct direct TanStack integration, not the requested Kirby-provided table. No internal package artifact or internal documentation is included in this report.

## Blocker and needed reference

The public evidence does not identify a Kirby release, preview, package source, or API for a TanStack Table v9-based table. If the POC requirement refers to a planned, unpublished, or otherwise non-public Kirby integration, the missing item is the exact authoritative reference: a Kirby package name and version/channel plus its release note, source change, or official API documentation. The issue should remain open until that reference is supplied or the requirement is deliberately revised. Do not implement an invented Kirby API or present direct `@tanstack/angular-table` usage as Kirby integration.

The public Cookbook's likely data-table pages at `/home/showcase/data-table` and `/components/data-table` returned 404 during this check, so current official usage documentation at another URL remains unverified.

## Sources

All sources below were checked on 2026-10-27.

- [`@kirbydesign/designsystem` npm package](https://www.npmjs.com/package/@kirbydesign/designsystem) and [version 12.0.0 metadata](https://registry.npmjs.org/@kirbydesign%2fdesignsystem/12.0.0)
- [`@kirbydesign/extensions-angular` npm package](https://www.npmjs.com/package/@kirbydesign/extensions-angular) and [version 6.0.0 metadata](https://registry.npmjs.org/@kirbydesign%2fextensions-angular/6.0.0)
- [Kirby design system repository](https://github.com/kirbydesign/designsystem), [repository license](https://github.com/kirbydesign/designsystem/blob/develop/LICENSE), [migration guide](https://github.com/kirbydesign/designsystem/blob/develop/MIGRATION.md), and [`TableSortableComponent` source](https://github.com/kirbydesign/designsystem/blob/develop/libs/designsystem/data-table/src/sortable/sortable.component.ts)
- [Kirby data-table issue #2494](https://github.com/kirbydesign/designsystem/issues/2494) and [implementation PR #2517](https://github.com/kirbydesign/designsystem/pull/2517)
- [`@tanstack/angular-table` npm package](https://www.npmjs.com/package/@tanstack/angular-table) and [version 9.3.1 metadata](https://registry.npmjs.org/@tanstack%2fangular-table/9.3.1)
- [Kirby Cookbook](https://cookbook.kirby.design) (the two candidate data-table routes above returned 404)
