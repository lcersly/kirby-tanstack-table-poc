import console from 'node:console';
import { URL } from 'node:url';

const fetch = globalThis.fetch;
const siteUrl = new URL('https://kirby-tanstack-table-poc.web.app/');
const rootResponse = await fetch(siteUrl);
const identityResponse = await fetch(new URL('/demo-version.json', siteUrl));

if (identityResponse.status === 404) {
  console.info(
    `Observed Firebase root HTTP ${rootResponse.status}; no public demo release marker exists.`,
  );
} else if (!identityResponse.ok) {
  throw new Error(
    `Could not inspect the live Firebase release marker (HTTP ${identityResponse.status}).`,
  );
} else {
  const identity = await identityResponse.json();
  if (
    !identity ||
    typeof identity.sourceCommit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(identity.sourceCommit) ||
    typeof identity.shortCommit !== 'string' ||
    !identity.sourceCommit.startsWith(identity.shortCommit) ||
    typeof identity.kirbyVersion !== 'string'
  ) {
    throw new Error('The live Firebase release marker is invalid.');
  }

  console.info(
    `Observed Firebase root HTTP ${rootResponse.status}; live demo commit ${identity.shortCommit} (${identity.sourceCommit}), Kirby ${identity.kirbyVersion}.`,
  );
}
