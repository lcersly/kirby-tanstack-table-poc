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
from 1 through 100,000. Large datasets can make the browser slow. Use browser
DevTools to measure time and memory. This prototype does not connect to Firebase
or use real payment data.

Build with `npm run build`.
