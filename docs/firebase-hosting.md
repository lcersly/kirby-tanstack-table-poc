# Firebase Hosting releases

The demo is served as a static Angular SPA on
<https://kirby-tanstack-table-poc.web.app>. Firebase Hosting deploys only
`dist/kirby-payment-overview-prototype/browser`; the checked CI artifact's
provenance file is kept outside that directory. The hosting rewrite serves the
Angular application shell at `/` and `/prototype/payment-overview`. A public
`demo-version.json` contains only the source commit and Kirby version so that a
failed release attempt can be compared with the live site without credentials.

## Publishing a checked artifact

There is no push-triggered deploy. A release must be explicitly approved for
the exact site and source revision before running the workflow.

1. Wait for the successful `CI` run on `main` for the intended full commit SHA.
   The workflow consumes that run's `payment-demo-<sha>` artifact; it does not
   install application dependencies or rebuild the demo.
2. In GitHub Actions, choose **Deploy checked Firebase artifact**, run it from
   `main`, and enter that exact full SHA as `source_sha`. A revision that is no
   longer the current `main` head is rejected before credential use.
3. The workflow verifies the CI run and artifact metadata, then uses the
   `firebase-demo` environment. That environment must remain restricted to
   trusted `main` deployments and supplies `FIREBASE_SERVICE_ACCOUNT` only to
   the deploy step. The workflow checks that the key identifies
   `github-hosting-deployer`, that the account can see the expected project and
   site, and that the downloaded artifact records the selected CI run.
4. After publication, an unauthenticated check requests the root and payment
   deep link, matches `demo-version.json` to the artifact, and checks that the
   delivered JavaScript contains the visible commit and Kirby version labels.
   If deployment or this check fails, the workflow inspects the public marker
   and reports the live release it observes (or that no demo marker exists).
   This reports operational verification separately from CI tests.

The CLI is pinned to `firebase-tools@15.34.1` and runs on the repository's
pinned Node.js version. The service-account JSON is written with restrictive
permissions to a temporary runner file, removed when the deploy step exits,
and is never uploaded as an artifact.

## Rollback and retention

In Firebase Console, open project `kirby-tanstack-table-poc`, then **Hosting**
and **Release history**. Choose the last known-good release and use the Console
rollback action to restore it to the live channel. Confirm the root and
`/prototype/payment-overview` afterward, and check the visible demo commit and
Kirby version. A rollback is a public site change and must be explicitly
approved; this procedure does not claim that one has been exercised.

Keep at least the previous successful release and its content retained so the
Console can restore it. The initial publish may have no previous application
release to restore. Before later publishes, verify that the live channel
retains at least one previous release. If it does not, stop and get approval to
change its retention setting; do not remove the last known-good version.
Retained versions consume the project's Hosting storage quota.

## Credential responsibility

The JSON key is long-lived. The maintainer is responsible for replacing the
`FIREBASE_SERVICE_ACCOUNT` environment secret when rotating the key and
revoking the old key only after the replacement is verified. The GitHub
environment's branch restriction protects the workflow secret; it does not
limit a copy of the key outside GitHub. Do not put the key in the repository,
browser build, CI artifact, or logs. Credential, IAM, API, billing, DNS, and
project changes require separate approval.
