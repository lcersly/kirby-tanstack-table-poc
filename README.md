# Kirby payment overview prototype

This throwaway Angular prototype compares three desktop layouts for the
read-only Danish payment overview in issue #6. It uses synthetic data and a
temporary, minimal TanStack Table renderer.

Run the local preview with:

```sh
npm run prototype
```

Open `http://localhost:4200/prototype/payment-overview`. Compare layouts A, B,
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
the chosen exact version from public npm. Replace the package and version in this
example with the dependency you are upgrading and its chosen release:

```sh
npm install --save-exact @kirbydesign/designsystem@12.0.0 --registry=https://registry.npmjs.org
```

Then run the checks above and commit both dependency files. Do not edit the lock
file by hand.
