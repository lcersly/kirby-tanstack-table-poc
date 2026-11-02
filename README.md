# Kirby payment overview prototype

This throwaway Angular prototype compares three desktop layouts for the
read-only Danish payment overview in issue #6. It uses synthetic data and
Kirby's experimental composable data grid.

Run the local preview with:

```sh
npm run prototype
```

The persistent top bar switches between two independent playspaces:

- **POC** at `http://localhost:4200/prototype/payment-overview` is the existing
  payment overview. It remains the default when opening `/`.
- **Table Playground** at `http://localhost:4200/prototype/table-playground` is
  a separate payment-table experiment with configurable controls. Its component
  is `src/app/table-playground.ts`; it does not share the POC's table or controls.

In the POC, compare layouts A, B,
and C with the floating switcher, the left and right arrow keys, or the
`?variant=A`, `?variant=B`, and `?variant=C` query parameter.

The default dataset has 1,000 rows. The generator accepts whole-number counts
from 1 through 100,000. The table renders every requested row without
pagination or virtualization. Rendering 100,000 rows can make the browser slow
or unresponsive. Use browser DevTools to inspect time and memory. This
prototype does not connect to Firebase or use real payment data.

Build with `npm run build`.

The page shows the Kirby version read from the installed
`@kirbydesign/designsystem` package and the short revision of the source commit.
After checks pass, main-branch CI deploys its checked browser artifact
automatically to Firebase Hosting. The deployment path and Firebase Console
rollback instructions are documented in
[docs/firebase-hosting.md](docs/firebase-hosting.md).

## Checks and dependency upgrades

Use Node.js 22.22.3 and npm 11.16.0, as pinned in `.nvmrc` and `package.json`.
Run the same checks as CI:

```sh
npm ci --registry=https://registry.npmjs.org
npm run lint
npm test
npm run build
```

Keep direct dependencies pinned to exact versions and commit
`package.json` and `package-lock.json` together. To upgrade a dependency, install
the chosen exact version from public npm for this project. This is a
project-specific exception to the usual Bankdata Artifactory registry. Do not
change global npm configuration. Replace the package and version in this
example with the dependency you are upgrading and its chosen release:

```sh
npm install --save-exact @kirbydesign/core@0.0.94-dev-f528d7a @kirbydesign/designsystem@11.11.2-dev-f528d7a @kirbydesign/extensions-angular@5.0.1-dev-f528d7a --registry=https://registry.npmjs.org
```

Then run the checks above and commit both dependency files. Do not edit the lock
file by hand.

## Composable grid integration

The POC's `PaymentTablePrototype` projects its own semantic table into
`kirby-data-grid-composable`, imported from
`@kirbydesign/designsystem/data-grid-composable`. Kirby owns the table instance,
header/cell rendering and horizontal scroll container. The seven columns,
Danish formatting, A/B/C layouts and row-count generator remain unchanged.
Sorting is disabled to preserve the original read-only behavior.
The projected table is keyboard-focusable so its horizontally scrolling content
remains accessible on narrow screens.

This uses the experimental packages from
[kirbydesign/designsystem#4898](https://github.com/kirbydesign/designsystem/pull/4898),
not the separate `kirby-data-grid` component. The draft's actual selector is
`kirby-data-grid-composable`. It does not provide pagination or virtualization;
the POC still renders every generated row. Its optional side panel is unused.
The independent Table Playground keeps its existing renderer and controls.

The dev designsystem requires Ionic Angular **9.0.2** exactly.
`@angular/platform-browser-dynamic` satisfies the extensions package's peer
dependency. TanStack remains installed as a required Kirby peer, but the POC
no longer imports it or creates its own table instance.

The Vitest configuration inlines Kirby modules so the existing unit-test
mocks for UI controls and icons also apply inside the real composable grid.
This avoids loading Ionic's browser-only modules in jsdom while still testing
Kirby's table model and cell/header rendering.
