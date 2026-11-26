# Kirby payment overview prototype

This throwaway Angular prototype demonstrates a read-only Danish payment
overview using synthetic data and
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

The default dataset has 1,000 rows. Open **Generér datasæt** to change the
dataset size. The generator accepts whole-number counts
from 0 through 100,000. Zero leaves the grid empty; this data-grid build does
not provide an empty-state presentation. The table renders every requested row without
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
npm install --save-exact @kirbydesign/core@0.0.99-dev-194f885 @kirbydesign/designsystem@12.2.0-dev-194f885 @kirbydesign/extensions-angular@6.2.0-dev-194f885 @ionic/angular@9.0.5 --registry=https://registry.npmjs.org --@kirbydesign:registry=https://registry.npmjs.org
```

Then run the checks above and commit both dependency files. Do not edit the lock
file by hand.

## Data grid integration

The payment overview uses `DataGridComponent` and its table, header, row and
cell directives from `@kirbydesign/designsystem/data-grid`. The application
creates the TanStack table with `injectTable` and registers its sorting
and row-selection features. Kirby renders the accessible grid and
selection checkboxes.

`PaymentTablePrototype` owns the table state and coordinates sorting and
selection.
`PaymentStatusCell` renders the custom status cell.

Sorting stays client-side, uses raw timestamps and amount values, and follows
Danish collation for text. Each column cycles through ascending, descending and
original order. Regenerating data keeps the active sort. Selection
uses stable payment IDs and survives sorting. Regenerating data clears selection.
The prototype has no filtering controls while data-grid filtering is pending.

The status column renders a Kirby badge through TanStack's
`flexRenderComponent`. Completed, pending and rejected payments use Kirby's
success, warning and danger colors alongside their status text. Sorting
continues to use the original status value.

The table remains horizontally scrollable and renders every requested row.
It does not paginate or virtualize large datasets. The independent Table
Playground keeps its own renderer and controls.

The POC uses the public dev build from
[kirbydesign/designsystem#4983](https://github.com/kirbydesign/designsystem/pull/4983).
That package exports `@kirbydesign/designsystem/data-grid` and requires
`@kirbydesign/core@0.0.99-dev-194f885`, `@tanstack/angular-table@^9.3.1`, and
`@ionic/angular@9.0.5`. The matching extensions package is pinned to
`6.2.0-dev-194f885`. `src/styles.scss` imports Kirby's global styles once.

The Vitest configuration inlines Kirby modules so the existing unit-test
mocks for UI controls and icons also apply inside the real data grid.
This avoids loading Ionic's browser-only modules in jsdom while still testing
Kirby's table model and cell/header rendering.
