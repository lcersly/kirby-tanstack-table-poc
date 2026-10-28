# Firebase Hosting

The read-only demo is served as a static Angular SPA at
<https://kirby-tanstack-table-poc.web.app>. `firebase.json` selects the existing
Hosting site, publishes only
`dist/kirby-payment-overview-prototype/browser`, and rewrites client routes to
the application shell.

## Automatic deployment

Merges to `main` run the normal CI checks and production build. After those
checks pass, the same workflow uploads the browser output and a dependent job
deploys that artifact to Firebase Hosting. Pull request runs never receive the
Firebase credential. Deployments use the `firebase-demo` environment and its
`FIREBASE_SERVICE_ACCOUNT` secret, run only after successful CI, and are
serialized so concurrent publishes cannot overlap. The workflow rejects a
revision that is no longer the current `main` head before it uses the Firebase
credential.

The Firebase CLI is pinned to `15.34.1`; the deploy job does not reinstall or
rebuild the application. Publishing happens only through this checked main
workflow. Its deployment job serializes publishes and does not cancel an
in-progress deployment. Firebase Console remains available for rollback.

The current-head check is a snapshot, not a lock on `main`. A new commit can
arrive after the check while the selected revision is publishing. The
maintainer accepts this limitation; no extra locking is required. A newer
passing main job can publish afterward, while an older job that reaches the
check late is rejected.

The browser artifact contains `demo-version.json` with the source commit and
Kirby version. After a successful deploy, the workflow checks unauthenticated
access to the root and `/prototype/payment-overview` and verifies that the
public marker and application bundles match that artifact. If deployment or
verification fails, it reports the release marker currently served by the site.

## Rollback and credentials

In Firebase Console, open project `kirby-tanstack-table-poc`, then **Hosting**
and **Release history**. Choose the last known-good release and use the Console
rollback action to restore it to the live channel. Confirm the root and payment
deep link afterward, including the displayed Kirby version and demo commit.
Rollback restores the selected artifact's matching metadata. A later passing
main update can replace the rolled-back release. The maintainer has deferred
live rollback recovery testing; any rollback needs separate approval.
The first publish may have no previous application release to restore. Keep at
least the previous successful release and its content retained; retained
versions count against Hosting storage.
As of 2026-10-28, the live Hosting channel reports `retainedReleaseCount: 3`,
which is the configured count of previous releases to retain. This does not
confirm that any specific historical release is still recoverable. Check the
chosen release's retained content before relying on it as a rollback target.

The JSON service-account key is long-lived. The maintainer is responsible for
rotating `FIREBASE_SERVICE_ACCOUNT` and revoking the old key after verifying
its replacement. The GitHub environment branch restriction does not constrain
a copied key. Never put the key in the repository, browser build, or logs.
Changes to credentials, IAM, APIs, billing, DNS, or the Firebase project
require separate approval.
