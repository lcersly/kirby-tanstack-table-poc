# Firebase deployment constraints research

**Checked:** 2026-10-27

**Scope:** Public-source research for building a public personal Angular repository in GitHub Actions and publishing its static demo on Firebase Hosting. No account identifiers, credentials, private material, cloud changes, installations, commits, or pushes are part of this research.

**Conclusion:** Firebase Hosting, rather than Firebase App Hosting, can publish the browser build on Spark without SSR or a paid serving backend. Use a protected deployment job after successful checks. The preferred keyless integration is `google-github-actions/auth` with Workload Identity Federation and service account impersonation, followed by the Firebase CLI using Application Default Credentials. Its authentication interoperability is documented and supported by the inspected source, but it has not been exercised against an account here. The Cloud WIF setup guide explicitly includes a billing prerequisite, so do not equate this recommendation with a verified Spark-only, no-billing setup. A service account JSON key is the documented alternative for Firebase's Hosting action. [^1][^2][^3][^4][^8][^11][^12][^13]

## Decision-relevant conclusions

- A static Angular SPA needs only its compiled HTML, JavaScript, CSS, and assets. Hosting serves them publicly over HTTPS on Firebase-provided domains. No Cloud Run, Cloud Functions, Firebase Web SDK, AngularFire deployment builder, or App Hosting backend is necessary for this serving model. Angular's manual static-deployment instructions and Hosting's directory-based deploy support this conclusion. [^1][^5][^6]
- Spark includes **10 GB Hosting storage and 10 GB/month data transfer**, shared across the project's sites and channels. Previous retained releases consume storage. At the storage limit, new deploys stop; after the transfer allowance and a short grace period, sites are disabled until the next month unless the plan changes. This is free hosting with availability limits, not unlimited hosting. [^2]
- For the current application builder, the usual directory to publish is `dist/<project>/browser`, not the parent directory. Verify the actual configured build output before deployment. An SPA rewrite must return `/index.html` for unmatched client routes. [^5][^7]
- The Firebase CLI officially recommends ADC for CI. The auth action exports `GOOGLE_APPLICATION_CREDENTIALS` pointing to its generated WIF configuration. ADC accepts WIF configuration files, and the CLI uses Google's auth library to obtain its access token. This establishes the integration contract without inventing a token input. [^8][^11][^12][^13]
- `FirebaseExtended/action-hosting-deploy` documents a required service account JSON key input. It has no native WIF/provider input and overrides `GOOGLE_APPLICATION_CREDENTIALS` with the file it creates from that input. Running the auth action before it is not a documented way to switch this action to WIF. Use auth plus the CLI for keyless deployment. [^9][^10]
- Public personal repositories can use environments, required reviewers, deployment branch restrictions, and environment secrets on GitHub Free. A deployment job can depend on successful build/test jobs with `needs`. These are documented capabilities, not verified settings in this repository. [^17][^18][^19]
- Hosting uploads a new version before it releases that version. A failed upload does not partially replace the live site. A failure reported after the release request is a different case and requires checking the current release. Previous content is rollback-capable only while retained. [^23][^24][^25][^26]
- A custom domain can be attached later, with DNS ownership verification and Firebase-managed SSL. Static Hosting does not require Blaze for this configuration; registering the domain itself is separate from Hosting. The reviewed documentation does not establish an unlimited number of custom domains or a numeric Spark-specific domain cap. [^1][^2][^30]

## Findings

### 1. Hosting product and free-plan boundary

Firebase calls Hosting "optimized for static and single-page web apps." It serves a directory of assets through its CDN and provides zero-configuration SSL. Cloud Functions and Cloud Run are optional integrations for dynamic behavior, not prerequisites for a static Angular demo. The quickstart's deployment command is `firebase deploy --only hosting`. [^1][^6]

Firebase App Hosting is a different product. Its cost documentation says it "requires a project that's on the pay-as-you-go Blaze pricing plan" and lists underlying Cloud Run, Cloud Build, Artifact Registry, and other services. An Angular application does not need that product just because it is an Angular application. The Hosting quickstart permits continuing with Hosting classic for static-only deployments even if the initializer detects SSR framework features. [^3][^6]

| Constraint | Documented Hosting behavior |
| --- | --- |
| Plan | Spark provides a no-cost Hosting quota without payment information. Blaze is not required for static Hosting within the quota. [^2][^4] |
| Storage | 10 GB at no cost, project-wide, including files associated with retained previous releases. A Spark project cannot deploy more content when it reaches the limit until content is deleted or the plan changes. [^2] |
| Transfer | 10 GB/month at no cost, project-wide. Both CDN cache hits and misses count. On Spark, the service grants a short grace period and then disables the sites until the next month, or an upgrade. [^2] |
| Individual file | Maximum 2 GB. [^2] |
| Domains and HTTPS | Firebase provides `web.app` and `firebaseapp.com` domains at no cost, permits connecting a custom domain, and automatically provisions SSL. The Hosting configuration is not documented as requiring a Blaze upgrade for a custom domain. No numeric Spark-specific custom-domain limit was established. [^1][^30] |
| Retention | Retained content counts toward storage. The channel API defines `retainedReleaseCount` as the number of previous releases to retain, permits 1 to 100, and defaults to 10 for new channels. This is not a promise of unlimited deploy history with recoverable content. [^2][^21][^22] |

Hosting storage is not Cloud Storage for Firebase. A billing requirement for the latter does not establish a billing requirement for static Hosting. Firebase's Hosting quota documentation explicitly separates them. [^2]

Billing needs separate attention for WIF setup. The Cloud deployment-pipelines guide explicitly says to verify that billing is enabled for its Google Cloud project. Firebase says linking a billing account to a Firebase project automatically upgrades it to Blaze. The WIF guide also recommends a dedicated identity project and allows its service account to be in another project. Therefore, Hosting's Spark capability is established, but an entirely billing-free WIF provisioning path is not established by this research. Do not silently link billing or upgrade the Hosting project. [^4][^14]

### 2. Angular output and Hosting configuration

Angular's current deployment documentation distinguishes these outputs for `@angular/build:application`:

- Static client rendering, or `outputMode: "static"`, publishes `dist/my-app/browser/`.
- Server rendering uses both `browser/` and `server/`, plus a running Node server.

The `outputPath` setting can change the location. The application-builder family also includes projects migrated to `@angular-devkit/build-angular:application`; check the actual workspace configuration rather than assuming a directory from the project name. This checkout does not yet contain an Angular workspace to validate. [^5][^31][^38]

A suitable static-only configuration would be the following. This is an example in the report, not an installed project configuration. Replace `<project>` with the actual output base. [^5][^7]

```json
{
  "hosting": {
    "public": "dist/<project>/browser",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "gha-creds-*.json"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**",
        "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store" }]
      }
    ]
  }
}
```

The `public` property names the existing directory to deploy. Exact static files take precedence over rewrites. The fallback handles direct navigation and refresh on Angular routes; it is not an HTTP redirect. Do not use a framework-aware `hosting.source` configuration, function rewrite, or server output for this static-only design. [^7]

The conservative cache policy above avoids serving an old application shell or version marker. Hosting documents custom `Cache-Control` headers in `firebase.json`, and automatically caches static content on the CDN. A redeploy clears its CDN cache, but that does not erase browser caches. [^7][^29]

For a later bandwidth optimization, apply a long `max-age` and `immutable` only to verified content-hashed assets. Keep the HTML shell, non-hashed assets, and version marker revalidated or uncached. Header rules match the incoming URL path, so test `/`, `/index.html`, and a deep link rather than assuming an `/index.html` header rule alone covers every SPA route. This is a recommended policy based on the documented header matching and cache behavior, not a Firebase-generated default. [^7][^29]

Do not deploy the repository root or upload the whole workspace as a build artifact. The auth action creates `gha-creds-*.json` in the workspace; its documentation expressly requires excluding these files from version control and release artifacts. Prefer completing the build and artifact upload before authentication. [^11]

### 3. Deployment interfaces and actual authentication interoperability

#### Firebase CLI

The supported static deployment command is:

```sh
firebase deploy --only hosting --project "$FIREBASE_PROJECT_ID" --non-interactive
```

The quickstart documents `--only hosting`; the CLI supports explicit project selection and CI authentication. An explicit project avoids dependence on a local default or a checked-in account-specific alias. Select a pinned CLI version during implementation rather than running an unbounded latest version in every build. No CLI was installed or run for this report. [^6][^8]

The interoperability evidence for WIF is a chain of first-party contracts, not an assumed compatibility between unrelated action inputs:

1. `google-github-actions/auth` supports `workload_identity_provider` and optional `service_account`. Supplying the service account selects WIF through impersonation. [^11]
2. Its default `create_credentials_file: true` and `export_environment_variables: true` export `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_GHA_CREDS_PATH`, and a Cloud SDK credential-file override. It also exposes `credentials_file_path`. Checkout must precede auth. [^11]
3. Google ADC searches `GOOGLE_APPLICATION_CREDENTIALS` and accepts a Workload Identity Federation credential configuration there, not only a private key. [^12]
4. Firebase's CLI documentation says, "The Firebase CLI will detect and use Application Default Credentials if they're set," and recommends ADC for CI. [^8]
5. The inspected CLI `requireAuth.ts` creates `GoogleAuth`, calls `getAccessToken()`, and uses this automatic-auth path when no legacy token or signed-in user is selected. [^13]

The pinned auth README also warns that its WIF option is not supported by the Firebase Admin SDK. That is not a blanket statement about Firebase CLI deployment. This recommendation concerns the static Hosting CLI path, whose inspected authentication implementation uses `google-auth-library`, not an application calling the Admin SDK. The ADC documentation and CLI source establish that narrower contract; they do not establish WIF compatibility for every Firebase SDK or CLI feature. [^11][^12][^13]

`GOOGLE_GHA_CREDS_PATH` is an additional variable exported by the auth action. The verified Firebase integration uses the ADC variable `GOOGLE_APPLICATION_CREDENTIALS`; this research did not establish a special Firebase CLI reader for `GOOGLE_GHA_CREDS_PATH`. Do not pass an OIDC JWT as `FIREBASE_TOKEN`, and do not pass a credential-file pathname as if it were the JSON contents of another action's input. [^8][^10][^11][^12][^13]

The core auth step for a future trusted deploy job is:

```yaml
permissions:
  contents: read
  id-token: write
steps:
  # Checkout, tool setup, and retrieval of the checked build artifact precede auth.
  - uses: google-github-actions/auth@v3
    with:
      project_id: ${{ vars.FIREBASE_PROJECT_ID }}
      workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
      service_account: ${{ vars.GCP_DEPLOY_SERVICE_ACCOUNT }}
      create_credentials_file: true
      export_environment_variables: true
  - run: firebase deploy --only hosting --project "$FIREBASE_PROJECT_ID" --non-interactive
    env:
      FIREBASE_PROJECT_ID: ${{ vars.FIREBASE_PROJECT_ID }}
```

This is a contract illustration, not a complete workflow or an end-to-end verification. It presumes a preinstalled, deliberately selected CLI and a validated artifact. Pin actions to reviewed full commit SHAs in an implemented workflow. Authenticate near the deployment rather than before a long build. The auth README warns about short-lived GitHub OIDC credentials; do not assume one authentication step remains usable for an arbitrarily long job. Neither a separate local `gcloud login` nor `gcloud` installation is part of this ADC handoff. [^8][^11][^12]

#### Firebase Hosting action

Firebase documents its GitHub integration and the `firebase init hosting:github` setup path. That initializer creates a service account, uploads a JSON key as a GitHub secret, and writes workflows. It is an external mutation, not a harmless local setup command, and was not run. [^9]

| Input | Current documented meaning |
| --- | --- |
| `firebaseServiceAccount` | Required service account JSON key contents. Store as a GitHub secret, never in the public repository. |
| `projectId` | Firebase project; otherwise the CLI needs a checked-in `.firebaserc`. |
| `channelId` | `live` deploys the live site. Omitted means an automatically generated branch/PR preview channel; another value selects a named preview channel. |
| `expires` | Preview lifetime after the last deployment, default 7 days; the Hosting maximum is 30 days from deployment. |
| `repoToken` | Optional GitHub token for check/comment integration and the preview link. Without it, find the URL in the log. It is not Firebase authentication. |
| `target` | Optional Hosting deploy target, relevant to multisite configuration. |
| `entryPoint` | Directory containing `firebase.json`, relative to the repository root, default `.`. |
| `firebaseToolsVersion` | CLI version, default `latest`; specify deliberately for reproducibility. |
| `disableComment` | Suppresses the PR preview comment. |
| `force` | Accepts interactive CLI prompts using `--force`; do not enable indiscriminately. |

These inputs come from the action README and `action.yml`. Preview expiration also follows Hosting's channel rules. [^10][^21]

The source calls `getInput("firebaseServiceAccount", { required: true })`, writes that value to a credentials file, and then launches the CLI with `GOOGLE_APPLICATION_CREDENTIALS` set to that file. There is no `workload_identity_provider` input or documented option to leave the existing ADC file intact. This establishes a JSON-key interface, not native OIDC support. The generic file-writing implementation is not proof that an improvised external-account JSON input is a supported WIF integration. [^10]

There is also a support-policy distinction. Firebase documents the Hosting integration, but the action repository says it is maintained by Googlers and "is not a supported Firebase product." The auth repository similarly says it is not an officially supported Google product or covered by a Google Cloud support contract. They are first-party-maintained integration projects, not a promise of a commercial support SLA. The Firebase CLI/Hosting and Cloud IAM documentation provide the underlying product contracts. [^8][^9][^10][^11]

### 4. Authentication, IAM, and APIs

#### WIF/OIDC with service account impersonation

The documented design uses an OIDC workload identity pool/provider that trusts GitHub's issuer, maps claims, and restricts which GitHub invocations can enter. The selected federated principal gets `roles/iam.workloadIdentityUser` on a dedicated deploy service account. That account gets the target project's Hosting permissions. The pool and service account can be in different projects. Grant the role to the restricted principal or principal set, not to the whole pool with `*`. [^14][^15]

For a live deploy from the trusted branch, a provider condition can follow this pattern. The values below are placeholders, not actual identifiers:

```text
assertion.repository_owner_id == 'OWNER_ID' &&
assertion.repository_id == 'REPOSITORY_ID' &&
assertion.repository == 'OWNER/REPOSITORY' &&
assertion.ref == 'refs/heads/main' &&
assertion.event_name == 'push'
```

Map `google.subject=assertion.sub` and each claim used by the condition or an IAM principal-set selector. Google documents branch restrictions with `assertion.ref`; the auth project's security guidance recommends numeric immutable owner/repository IDs to resist name reuse. The owner can be a personal account; this does not require a GitHub organization. Replace `main` with the eventual approved deploy branch. Optionally require the intended environment claim too. [^14][^15][^16]

Do not copy an old branch-shaped `sub` string without checking its expected format. An environment changes the subject context, and GitHub's current documentation describes immutable default subjects for repositories created, renamed, or transferred after July 15, 2026. A separate `ref` condition remains useful when the subject identifies an environment. This research inspected documentation only, not a live OIDC token. [^16][^20]

`id-token: write` allows the job to request an OIDC token. It does not itself grant Google Cloud access or write access to the repository. Grant it only to the deploy job, alongside `contents: read` unless other narrowly justified GitHub permissions are needed. Cloud-side trust restrictions remain essential even when a workflow has no stored secret. [^16][^20]

#### Service account key JSON

A JSON key is a documented alternative for the Hosting action, or for ADC with the CLI. Keep it in a protected environment secret, make it available only to the deployment job, rotate/revoke it deliberately, and never embed it in an Angular build or publish it as an artifact. Google warns that service account keys are long-lived and can be used without the additional external identity proof required by WIF. This alternative avoids claiming a verified billing-free WIF setup, but introduces a long-lived secret and still requires approved account/IAM setup. [^9][^10][^11][^12]

#### `firebase login:ci` and `FIREBASE_TOKEN`

The CLI documentation marks this method "Legacy," says it is less secure than ADC, and no longer recommends it. The current CLI source goes further: both `login:ci` and authentication through `FIREBASE_TOKEN`/`--token` emit a deprecation warning saying removal is planned for a future major version. The command still exists in the inspected source; no removal date or version is established. Do not choose it for a new workflow. [^8][^13][^32]

#### Roles and least privilege

There are separate permissions for provisioning identity infrastructure, impersonating a service account, and deploying content. Do not grant the CI deploy account Owner, Editor, Firebase Admin, IAM administration, or billing administration simply to make deployment work. [^14][^33]

| Scope | Role or permission | What is established |
| --- | --- | --- |
| Target Hosting project | `roles/firebasehosting.admin` | Documented product-scoped deploy role. Includes `firebase.projects.get`, `resourcemanager.projects.get`, and `firebasehosting.sites.update`, among other Hosting permissions. Current CLI declares the first as its base check and the last as its Hosting deploy check. This role is broader than an operation-specific custom role. [^13][^33] |
| Target project, documented action recipe | `roles/serviceusage.apiKeysViewer` | The Hosting action's manual service-account guide explicitly marks API Keys Viewer "Required for CLI deploys." Do not omit this from the documented recipe by claiming Hosting Admin alone was tested here. [^34] |
| Consumer/quota project, when applicable | `roles/serviceusage.serviceUsageConsumer` | Provides `serviceusage.services.use` and service-state inspection. Relevant when a request consumes that project's quota/billing. It is not included in Hosting Admin, and API Keys Viewer is a different role. The sources do not prove this is an unconditional extra role for every static deployment. [^33][^35] |
| Deploy service account | `roles/iam.workloadIdentityUser` granted to the restricted federated principal | Required impersonation binding in the documented WIF flow. Not a Hosting permission. Ordinary single-account WIF does not call for blanket Token Creator grants; the auth docs describe extra Token Creator requirements for distinct cases such as domain-wide delegation. [^11][^14] |
| Conditional preview behavior | `roles/firebaseauth.admin` | The action's recipe needs this to add preview URLs to Firebase Authentication authorized domains. This is not a reason to grant Auth Admin to a static live-only CLI deploy with no Auth integration. [^34] |
| Conditional server rewrites | `roles/run.viewer` | The action's recipe requires this for Hosting rewrites to Cloud Run/Cloud Functions. Omit those rewrites for this static-only design. [^34] |
| Provisioning actor, not routine deploy job | WIF Pool Admin; API enablement and IAM-binding permissions as needed | Google documents `roles/iam.workloadIdentityPoolAdmin` for WIF configuration and `serviceusage.services.enable`, for example through Service Usage Admin, for API enablement. Create the identity setup under separate approval. [^14] |

The defensible predefined-role baseline is Hosting Admin plus the CLI/API permissions required by the chosen path, with Workload Identity User on the impersonated account for WIF. A globally minimal permission set for a particular pinned CLI and project was not demonstrated. Start with the documented recipe, omit its explicitly conditional Auth/Run permissions when those features are absent, and validate under the chosen account before narrowing to a custom role. Do not resolve an authorization failure by granting broad project administration. [^13][^33][^34][^35]

#### APIs

- Hosting deploy uses `firebasehosting.googleapis.com`. The REST deployment guide explicitly requires enabling the Firebase Hosting API. [^23]
- Google documents `iam.googleapis.com`, `iamcredentials.googleapis.com`, `sts.googleapis.com`, and `cloudresourcemanager.googleapis.com` for deployment-pipeline WIF setup. The impersonation section repeats the IAM, STS, and Service Account Credentials API prerequisites. Enable them in the appropriate identity/service-account projects after the project layout is approved. [^14]
- Firebase CLI also performs Firebase project, Resource Manager, and API-state operations. Verify the selected project's Firebase Management, Resource Manager, and Service Usage API availability during setup, rather than assuming a Hosting API token alone covers every CLI call. The CLI's Hosting prepare phase checks/enables the Hosting API. Provision prerequisites beforehand instead of granting routine CI API-enablement rights. [^13][^35]
- Pure static Hosting does not require provisioning Cloud Build, Cloud Run, Functions, Artifact Registry, a Cloud Storage for Firebase bucket, or Firebase Authentication. Those are outside the chosen architecture. [^1][^3][^6]

### 5. Checks, public-repository trust, and deployment gates

Use an unprivileged build/check workflow on `pull_request` and a trusted-branch `push` workflow for live deployment. In the latter, make the deploy job depend on all required checks and the production build, for example `needs: [checks, build]`. GitHub states that these jobs "must complete successfully" before the dependent job runs; a failed or skipped dependency normally skips deployment. Do not override that safety with `always()` or continue-on-error settings on required checks. [^17]

Reference a preconfigured `firebase-demo` environment from the deploy job. Restrict its allowed branch explicitly, configure reviewers if wanted, and decide whether administrators may bypass the gate. GitHub Free supports these features for a public personal repository. Up to six users/teams can be required reviewers, but only one approval is necessary. A personal owner needs another eligible reviewer if self-review prevention is enabled and the owner triggers the run. Merely naming an environment in YAML does not configure protection; an absent environment can be auto-created without rules. [^18][^19]

Standard GitHub-hosted runners for public repositories have free Actions usage. Do not generalize this to larger runners or every optional storage/service configuration. A public repository is not itself a billing blocker for the standard build job. [^36]

Public-repository restrictions matter even for a demo:

- On ordinary fork `pull_request` runs, GitHub does not pass repository secrets, apart from the read-only `GITHUB_TOKEN`. First-time contributors may need approval to run checks. That approval is not approval to give fork code cloud credentials. Dependabot PRs have analogous restrictions. [^37]
- Default to checks only for forks. A same-repository preview can be a later, separately protected job after review. Preview URLs are sharable URLs, not an authorization boundary, and Firebase warns that preview apps can interact with the real project's backends. [^9][^21]
- Do not use `pull_request_target` to check out and execute an untrusted PR with credentials. GitHub explicitly warns about write-token/secret exposure and cache poisoning. [^37]
- `workflow_run` can access secrets and write tokens even if the earlier workflow could not. It runs on completion regardless of success unless the deploy workflow checks `github.event.workflow_run.conclusion == 'success'`. If used, also constrain the triggering workflow, event, repository, branch, exact checked commit, and artifact provenance. Never execute scripts or restore executable caches supplied by an untrusted fork in the privileged job. A successful fork build is not sufficient authorization. A single trusted-push workflow with `needs` avoids much of this complexity. [^37]
- Deploy the artifact from the exact successful build, not a newly resolved branch head or an arbitrary artifact named `dist`. Keep auth material out of all artifact uploads. Serialize live deploys and check which commit is newest before publishing so an older delayed run does not overwrite a newer demo. These are recommended workflow constraints, not configured repository facts. [^11][^17]

### 6. Atomic release, retention, history, and recovery

A Hosting version contains both static files and serving configuration. A release points to a version and makes that version active for a channel. The REST deployment sequence is create version, specify hashes, upload required files, finalize version, then create release. The API describes release creation as the step that "makes the content of the specified version actively display." [^21][^23][^24]

The inspected CLI follows this sequence. Its deployment coordinator completes the upload/deploy phase before the release phase. Hosting's release implementation sets the version to `FINALIZED` before calling `createRelease`. Therefore, an upload failure before release leaves the existing live release in place, rather than exposing the subset already uploaded. This is per-site/channel publication, not a transactional guarantee across multiple sites, products, browser requests, or user caches. [^13][^23][^24]

A nonzero CI result is not proof that nothing changed. A response can be lost after the server accepts release creation, or a later postdeploy hook can fail after publication. Inspect release history/current release and the served commit marker before retrying or rolling back. The CLI source explicitly has a postdeploy phase after releases. [^13][^24]

The version lifecycle is documented as follows. [^25]

| State | Meaning |
| --- | --- |
| `CREATED` | Version exists and content is being added. |
| `FINALIZED` | All content is added and the version is immutable. It is eligible for release; finalized alone does not mean live. |
| `CLONING` | Content is still being copied from another version. |
| `ABANDONED` | Not finalized within 12 hours; the system automatically deletes it. |
| `EXPIRED` | Outside the configured retention limit; content is scheduled for deletion. |
| `DELETED` | Version has been deleted. |

`VERSION_STATUS_UNSPECIFIED` is a sentinel, not a deliberate deploy state. [^25]

#### Retention and preview channels

The channel API says `retainedReleaseCount` keeps **previous** releases, is configurable from **1 to 100**, and defaults to **10 for new channels**. Do not turn this into an assertion that all existing channels retain exactly ten versions, or that ten is a lifetime deployment cap. The actual live channel setting has not been read. [^22]

The console lets the owner set release retention per channel. When the limit is exceeded, Hosting schedules old content for deletion, oldest first. Manual deletion of a previous live release schedules its content for deletion within 24 hours but keeps release metadata. The currently served live release cannot be manually deleted through that flow. A release-history entry is therefore not proof that its content can still be restored. No separate lifetime cap on release metadata/history was established in the reviewed docs; `releases.list`'s default page size of 100 is pagination, not a 100-release history guarantee or limit. [^21][^26]

Preview channels expire after seven days by default. Deployment can set an expiry up to 30 days from that deployment, and the action resets the expiry when it redeploys. The live channel does not expire. When a preview channel expires or is deleted, Hosting schedules its releases and versions for deletion within 24 hours, except a version still referenced by another release. Preview content consumes the same project's quota. [^2][^10][^21]

#### Rollback and clone mechanisms

- The console's live-channel Release history has **Roll back** on a retained earlier release. Rollback creates a new release pointing to the same previous version. The management guide says preview-channel rollback is not available in that flow. [^21]
- CLI promotion of a channel's current version uses `firebase hosting:clone SOURCE_SITE:SOURCE_CHANNEL TARGET_SITE:TARGET_CHANNEL`. For a known retained historical version, the documented form is `firebase hosting:clone SITE_ID:@VERSION_ID SITE_ID:live`. These commands deploy, so they require later explicit approval. There is no claim here that a `firebase hosting:rollback` command exists. [^21]
- REST release enumeration supports `GET /v1beta1/sites/SITE_ID/releases`, or a channel parent, with `pageToken` pagination. Site-wide results include live and active preview releases; select the live channel or inspect the result rather than assuming every entry is a production deployment. [^26]
- To restore an existing finalized version on the same site, create a new live release with that version's `versionName`. If cloning content is required, call `sites.versions.clone` with `sourceVersion` and `finalize: true`, wait for its operation, then release the resulting version. The release API requires the version and destination site to match. A clone alone is not the REST publication step. Deleted content cannot be reconstructed by copying its metadata. [^24][^27]

#### Visible build identity

At build time, generate a small public `version.json` containing only the source commit SHA and, if useful, a non-sensitive build timestamp or run number. Generate it in the browser output after compilation and before the checked artifact is uploaded, or copy a generated asset through Angular's assets configuration. Then the visible application or a postdeploy check can read it. Cache that marker conservatively. This is an application/build mechanism based on static-file deployment, not automatic interpolation by Firebase Hosting. [^5][^7][^29][^31]

A release message can also record the commit. The inspected CLI forwards `--message` to the Hosting release; the API documents a release `message` of up to 512 characters and version `labels` for metadata/filtering. Release messages, version labels, and a public version file are different mechanisms. No automatic CLI `--label` or Firebase JSON commit substitution is claimed. [^13][^25][^28]

### 7. Adding a custom domain later

Publish initially on the Firebase-provided domains, then connect a custom domain to the same live Hosting site. The domain change does not require changing the Angular build/deployment architecture or using App Hosting. Firebase documents custom-domain attachment and automatic SSL without a Blaze-only prerequisite for static Hosting. Domain purchase/renewal remains separate, and no unlimited-domain entitlement is inferred. [^1][^2][^30]

Later setup requires control of the domain's DNS. Complete the Hosting-site setup, add the domain in the Hosting console, retain the ownership TXT record requested by the wizard, and apply the exact DNS records it supplies. Remove conflicting records or address CAA restrictions if instructed. Do not copy generic IP addresses from an example as if they were this site's required configuration. [^30]

Firebase provisions and renews the SSL certificate. Ownership propagation and SSL provisioning can take up to 24 hours at the documented stages. Advanced setup supports preparing ownership and SSL before directing an already-used domain's traffic to Hosting. The domain and DNS must be approved before any of these changes. [^30]

## Documented capability versus unverified account state

| Area | Documented capability | Account/repository state here |
| --- | --- | --- |
| Public build | Standard hosted runners support public-repo builds without per-minute charges. [^36] | Actions enablement, allowed actions, package access, workflow settings, and actual checks are unverified. |
| Static Hosting | Spark can serve public HTTPS assets within its project quota. [^1][^2][^4] | Project existence, Firebase terms acceptance, selected plan, Hosting site, API state, and quota usage are unverified. |
| Angular artifact | Current application-builder static output normally ends in `browser/`. [^5] | This checkout has no Angular workspace/build configuration to validate. No build was run. |
| Deployment gates | Public personal repos on Free can configure required reviewers and branch-restricted environments. [^18][^19] | No environment, reviewer, branch protection, ruleset, or bypass setting was inspected or changed. |
| Keyless auth | WIF credentials from the auth action are ADC-compatible with the CLI's documented CI path. [^8][^11][^12][^13] | No pool/provider, service account, impersonation binding, condition, token, or successful deploy was verified. The Cloud guide's billing prerequisite remains a setup decision. |
| JSON-key auth | The Hosting action documents this input and a secret-based setup. [^9][^10] | No existing key or secret was read, created, or tested. |
| Release recovery | Retention, history listing, live rollback, and version cloning are documented. [^21][^22][^26][^27] | Actual retention settings, available versions, current release, and recovery permissions are unverified. |
| Custom domain | Domain attachment and managed SSL are documented for Hosting. [^30] | Domain ownership, DNS access, records, certificate state, and numeric account-specific domain limits are unverified. |
| Local CLI/account | Firebase and Google Cloud CLIs can expose project/account state through read-only commands. [^8] | The task states `firebase` and `gcloud` are not installed. Neither was run or installed. No login, credential-file inspection, token generation, or account discovery occurred. |

## Risks and open items

1. **Billing boundary for WIF.** The static Hosting target can be Spark. The consulted WIF provisioning guide explicitly asks for billing on its setup project. An entirely Spark/no-billing WIF setup was not established. Decide whether a separate identity project is appropriate, whether billing is acceptable, or whether the approved JSON-key alternative is preferable. [^2][^4][^14]
2. **Exact minimum permissions.** Hosting Admin is product-scoped; the action recipe additionally calls for API Keys Viewer, with Auth/Run roles conditional on its behavior. Whether the selected CLI requires Service Usage Consumer depends on the consumer/quota path. No account-backed least-privilege test was run. [^33][^34][^35]
3. **Quota exhaustion and rollback loss.** Popularity, preview traffic, and old builds share a project quota. Retention cleanup can remove a known-good rollback target while leaving its history entry visible. Choose and monitor retention instead of assuming free, indefinite archives. [^2][^21][^22]
4. **Untrusted workflow content.** Fork code, dependency lifecycle scripts, artifacts, and caches must not execute with deployment authority. WIF removes a stored key, not the need to protect the cloud trust policy and workflow. [^11][^15][^37]
5. **Current source versus a selected release.** Source inspection establishes the current implementation contract, not that every old action/CLI version behaves the same. Select reviewed versions/SHAs and validate that exact combination later. The cited action repositories also disclaim formal product support. [^10][^11][^13]
6. **No account-level or runtime verification.** The browser output, deep links, cache headers, WIF token exchange, API grants, deploy failure behavior, rollback, and domain attachment were not exercised. Numeric custom-domain limits and a separate lifetime release-metadata cap were not established from the reviewed documentation. [^7][^21][^22][^26][^30]

## Later prerequisites requiring approval

These are follow-up operations, not authorizations or commands executed by this report.

- Select an existing personal Firebase/Google Cloud project, or explicitly approve creation of a new one and its Hosting site. Confirm terms, project ownership, intended public content, and static-only scope.
- Explicitly choose Spark or approve any billing linkage/Blaze upgrade. If using a separate WIF project, approve its project creation and billing posture independently. Linking billing to the Hosting project's underlying Cloud project changes the Firebase plan. [^4][^14]
- Approve the required API enablements, service-account creation, least-privilege role grants, WIF pool/provider, restricted claim mappings/conditions, and impersonation binding. Keep provisioning rights separate from deploy rights.
- Approve the GitHub environment, allowed deploy branch, reviewer/self-review/bypass policy, and any branch protection changes. Choose the actual required checks before wiring `needs`.
- Approve repository/environment variables for the selected project, WIF provider, and deploy identity. If the key route is chosen, separately approve key creation and storage in an environment secret, with a rotation/revocation plan. Never place actual identifiers or secrets in this public research report.
- Select runtime, CLI, and action versions; implement configuration/workflows in a later change; approve tool installation if needed. Validate the build output and ensure generated credential files cannot enter an artifact or deploy directory.
- Approve a bounded first preview/live deployment and recovery test, its public URL, retention settings, and any later rollback. First verify root/deep-link behavior, version identity, headers, and recovery from an upload failure.
- Later, approve the exact custom domain and DNS/certificate changes. Verify ownership and any registrar costs before connecting it.

## Verification against repository Firebase skills

Method: the runtime skill catalog did not list the repository-local skills, so their definitions were read directly from `.agents/skills/` on `origin/main` (commit `a3235f5`). Read: `firebase-hosting-basics` (with `configuration.md`, `deploying.md`), `firebase-app-hosting-basics`, and `firebase-basics`. The auth and Firestore skills are out of scope.

Confirmed by the skills, with no conflict found:

- Static sites and SPAs without SSR belong on classic Hosting; App Hosting is for SSR/ISR frameworks and requires Blaze.
- `firebase.json` `public` names the deploy directory, and a `** -> /index.html` rewrite serves SPA routes.
- `firebase deploy --only hosting` publishes to the default `web.app` and `firebaseapp.com` sites.
- Preview channels (7-day default expiry) and `hosting:clone SOURCE_SITE:CHANNEL TARGET_SITE:live` promote a version to live without rebuilding.
- The Hosting skill lists GitHub Actions automation and custom domains as supported features.

Not covered by the skills, so they rest only on the cited primary sources above: Spark quotas, WIF with CLI ADC, `action-hosting-deploy` authentication, IAM roles, WIF billing, failed-deploy behavior, retained-version rollback, and custom-domain limits.

Clarifications: the skills invoke the CLI as `npx -y firebase-tools@latest`, which is unpinned; a CI workflow should pin a reviewed version. The `firebase-basics` skill requires pausing to ask for an existing project ID or approval to create one, which matches the later prerequisites above. The App Hosting skill's phrase "Angular" means SSR Angular, so it does not apply to this static output.

Account-specific unknowns are unchanged: project existence and selection, plan and billing, IAM, exact minimum roles, and whether WIF setup can avoid billing.

## Sources

Every source below was retrieved on **2026-10-27**. All are public, first-party documentation or official integration/CLI source. Google Cloud URLs may redirect to `docs.cloud.google.com`. Quotes above are short excerpts; other findings paraphrase the cited source. Source inspection is not an account-backed integration test.

[^1]: Firebase, [Firebase Hosting overview](https://firebase.google.com/docs/hosting). Retrieved 2026-10-27.
[^2]: Firebase, [Understand Hosting usage, quotas, and pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing). Retrieved 2026-10-27.
[^3]: Firebase, [App Hosting costs](https://firebase.google.com/docs/app-hosting/costs). Retrieved 2026-10-27.
[^4]: Firebase, [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans). Retrieved 2026-10-27.
[^5]: Angular, [Deployment](https://angular.dev/tools/cli/deployment). Retrieved 2026-10-27.
[^6]: Firebase, [Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart). Retrieved 2026-10-27.
[^7]: Firebase, [Configure Hosting behavior](https://firebase.google.com/docs/hosting/full-config). Retrieved 2026-10-27.
[^8]: Firebase, [CLI reference, including CI and ADC](https://firebase.google.com/docs/cli#use_the_cli_with_ci_systems). Retrieved 2026-10-27.
[^9]: Firebase, [Deploy to live and preview channels via GitHub pull requests](https://firebase.google.com/docs/hosting/github-integration). Retrieved 2026-10-27.
[^10]: FirebaseExtended, [Hosting action README](https://github.com/FirebaseExtended/action-hosting-deploy), and inspected revision `500ac625ca2dd40cbd15f7659af953801858032a`: [action inputs](https://github.com/FirebaseExtended/action-hosting-deploy/blob/500ac625ca2dd40cbd15f7659af953801858032a/action.yml), [required credential input and setup](https://github.com/FirebaseExtended/action-hosting-deploy/blob/500ac625ca2dd40cbd15f7659af953801858032a/src/index.ts), [credential file creation](https://github.com/FirebaseExtended/action-hosting-deploy/blob/500ac625ca2dd40cbd15f7659af953801858032a/src/createGACFile.ts), and [CLI invocation and ADC override](https://github.com/FirebaseExtended/action-hosting-deploy/blob/500ac625ca2dd40cbd15f7659af953801858032a/src/deploy.ts). Retrieved 2026-10-27.
[^11]: Google GitHub Actions, [Auth action README](https://github.com/google-github-actions/auth/blob/12060449e87204eca501a11f2f7f1483024afff0/README.md), covering WIF, impersonation, exported credential files/variables, runtime and lifetime caveats, and support status. Retrieved 2026-10-27.
[^12]: Google Cloud, [How Application Default Credentials works](https://cloud.google.com/docs/authentication/application-default-credentials). Retrieved 2026-10-27.
[^13]: Firebase CLI, inspected revision `855f140c7b55cd46e4ff00f030a1d1268b42f1d0`: [ADC and legacy token authentication](https://github.com/firebase/firebase-tools/blob/855f140c7b55cd46e4ff00f030a1d1268b42f1d0/src/requireAuth.ts), [base permission check](https://github.com/firebase/firebase-tools/blob/855f140c7b55cd46e4ff00f030a1d1268b42f1d0/src/requirePermissions.ts), [target permissions and deployment ordering](https://github.com/firebase/firebase-tools/blob/855f140c7b55cd46e4ff00f030a1d1268b42f1d0/src/deploy/index.ts), [Hosting API preparation](https://github.com/firebase/firebase-tools/blob/855f140c7b55cd46e4ff00f030a1d1268b42f1d0/src/deploy/hosting/prepare.ts), and [finalization, release, and message](https://github.com/firebase/firebase-tools/blob/855f140c7b55cd46e4ff00f030a1d1268b42f1d0/src/deploy/hosting/release.ts). Retrieved 2026-10-27.
[^14]: Google Cloud, [Configure Workload Identity Federation with deployment pipelines](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines). Includes billing/API prerequisites, GitHub mappings and conditions, separate projects, and service-account impersonation bindings. Retrieved 2026-10-27.
[^15]: Google GitHub Actions, [Auth security considerations](https://github.com/google-github-actions/auth/blob/12060449e87204eca501a11f2f7f1483024afff0/docs/SECURITY_CONSIDERATIONS.md). Retrieved 2026-10-27.
[^16]: GitHub, [OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc). Retrieved 2026-10-27.
[^17]: GitHub, [Workflow syntax, job dependencies](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds). Retrieved 2026-10-27.
[^18]: GitHub, [Managing environments for deployment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments). Retrieved 2026-10-27.
[^19]: GitHub, [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments). Retrieved 2026-10-27.
[^20]: GitHub, [Configuring OIDC in Google Cloud Platform](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform). Retrieved 2026-10-27.
[^21]: Firebase, [Manage Hosting channels, releases, and versions](https://firebase.google.com/docs/hosting/manage-hosting-resources). Retrieved 2026-10-27.
[^22]: Firebase Hosting REST API, [Channel resource and retainedReleaseCount](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels). Retrieved 2026-10-27.
[^23]: Firebase, [Deploy using the Hosting REST API](https://firebase.google.com/docs/hosting/api-deploy). Retrieved 2026-10-27.
[^24]: Firebase Hosting REST API, [Create a release](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.releases/create). Retrieved 2026-10-27.
[^25]: Firebase Hosting REST API, [Version resource, labels, and lifecycle states](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.versions). Retrieved 2026-10-27.
[^26]: Firebase Hosting REST API, [List releases](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.releases/list). Retrieved 2026-10-27.
[^27]: Firebase Hosting REST API, [Clone a version](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.versions/clone). Retrieved 2026-10-27.
[^28]: Firebase Hosting REST API, [Release resource and message](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels.releases). Retrieved 2026-10-27.
[^29]: Firebase, [Manage cache behavior](https://firebase.google.com/docs/hosting/manage-cache). Retrieved 2026-10-27.
[^30]: Firebase, [Connect a custom domain](https://firebase.google.com/docs/hosting/custom-domain). Retrieved 2026-10-27.
[^31]: Angular, [Workspace configuration, builders, output paths, and assets](https://angular.dev/reference/configs/workspace-config). Retrieved 2026-10-27.
[^32]: Firebase CLI, [login:ci deprecation warning](https://github.com/firebase/firebase-tools/blob/855f140c7b55cd46e4ff00f030a1d1268b42f1d0/src/commands/login-ci.ts). Retrieved 2026-10-27.
[^33]: Google Cloud IAM, [Firebase Hosting roles and permissions](https://cloud.google.com/iam/docs/roles-permissions/firebasehosting). Retrieved 2026-10-27.
[^34]: FirebaseExtended, [Manual service-account setup and role requirements](https://github.com/FirebaseExtended/action-hosting-deploy/blob/500ac625ca2dd40cbd15f7659af953801858032a/docs/service-account.md). Retrieved 2026-10-27.
[^35]: Google Cloud, [Service Usage access control](https://cloud.google.com/service-usage/docs/access-control), including Service Usage Consumer and API Keys Viewer role descriptions. Retrieved 2026-10-27.
[^36]: GitHub, [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). Retrieved 2026-10-27.
[^37]: GitHub, [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), especially `pull_request`, `pull_request_target`, and `workflow_run`. Retrieved 2026-10-27.
[^38]: Angular, [Build-system migration and application-builder package names](https://angular.dev/tools/cli/build-system-migration). Retrieved 2026-10-27.
