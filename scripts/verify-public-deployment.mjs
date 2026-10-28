import console from 'node:console';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

const siteUrl = new URL('https://kirby-tanstack-table-poc.web.app/');
const fetch = globalThis.fetch;

export async function verifyPublicDeployment({
  siteUrl,
  expectedIdentity,
  fetchImpl = globalThis.fetch,
}) {
  async function getPublicPage(url) {
    const response = await fetchImpl(url);
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error(
        `Public page verification failed for ${url.pathname} (HTTP ${response.status}).`,
      );
    }

    return response.text();
  }

  const rootHtml = await getPublicPage(siteUrl);
  const deepLink = new URL('/prototype/payment-overview', siteUrl);
  const deepLinkHtml = await getPublicPage(deepLink);

  if (rootHtml !== deepLinkHtml) {
    throw new Error('The public payment-overview deep link did not return the application shell.');
  }

  const identityUrl = new URL('/demo-version.json', siteUrl);
  const identityResponse = await fetchImpl(identityUrl);
  if (!identityResponse.ok) {
    throw new Error(`Public build identity verification failed (HTTP ${identityResponse.status}).`);
  }
  const identity = await identityResponse.json();
  if (
    !identity ||
    identity.sourceCommit !== expectedIdentity.sourceCommit ||
    identity.shortCommit !== expectedIdentity.shortCommit ||
    identity.kirbyVersion !== expectedIdentity.kirbyVersion
  ) {
    throw new Error('The public release identity does not match the checked CI artifact.');
  }

  const scriptSources = Array.from(
    rootHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.m?js(?:\?[^"']*)?)["'][^>]*>/gi),
    (match) => match[1],
  );

  if (scriptSources.length === 0) {
    throw new Error('The public application shell does not reference a JavaScript bundle.');
  }

  const pendingScripts = [...scriptSources];
  const visitedScripts = new Set();
  const applicationScripts = [];

  while (pendingScripts.length > 0) {
    const source = pendingScripts.pop();
    const scriptUrl = new URL(source, siteUrl);
    if (scriptUrl.origin !== siteUrl.origin) {
      throw new Error(
        'The public application references a JavaScript bundle outside the Firebase site.',
      );
    }

    if (visitedScripts.has(scriptUrl.href)) {
      continue;
    }
    visitedScripts.add(scriptUrl.href);

    const response = await fetchImpl(scriptUrl);
    if (!response.ok) {
      throw new Error(`Public JavaScript bundle verification failed (HTTP ${response.status}).`);
    }

    const script = await response.text();
    applicationScripts.push(script);
    for (const match of script.matchAll(/import\(["']([^"']+\.m?js(?:\?[^"']*)?)["']\)/g)) {
      pendingScripts.push(match[1]);
    }
  }

  const applicationCode = applicationScripts.join('\n');

  if (
    !applicationCode.includes(expectedIdentity.shortCommit) ||
    !applicationCode.includes(expectedIdentity.kirbyVersion) ||
    !applicationCode.includes('Kirby ') ||
    !applicationCode.includes('Demo ')
  ) {
    throw new Error(
      'The public release does not contain the visible selected commit and Kirby version.',
    );
  }
}

async function inspectLiveRelease() {
  const rootResponse = await fetch(siteUrl);
  const identityResponse = await fetch(new URL('/demo-version.json', siteUrl));
  if (identityResponse.status === 404) {
    console.info(
      `Observed Firebase root HTTP ${rootResponse.status}; no public demo release marker exists.`,
    );
    return;
  }

  if (!identityResponse.ok) {
    throw new Error(
      `Could not inspect the live Firebase release marker (HTTP ${identityResponse.status}).`,
    );
  }

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

async function runCli() {
  const mode = process.argv[2];
  if (mode === 'inspect') {
    await inspectLiveRelease();
    return;
  }
  if (mode !== 'verify') {
    throw new Error('Expected mode: verify or inspect.');
  }

  const artifactMarker = resolve('dist/kirby-payment-overview-prototype/browser/demo-version.json');
  const expectedIdentity = JSON.parse(readFileSync(artifactMarker, 'utf8'));
  if (
    typeof expectedIdentity.sourceCommit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(expectedIdentity.sourceCommit) ||
    !expectedIdentity.sourceCommit.startsWith(expectedIdentity.shortCommit)
  ) {
    throw new Error('The checked artifact contains an invalid demo version marker.');
  }
  await verifyPublicDeployment({ siteUrl, expectedIdentity });
  console.info(
    `Verified public root and payment deep link for commit ${expectedIdentity.shortCommit} with Kirby ${expectedIdentity.kirbyVersion}.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Public deployment verification failed.',
    );
    process.exitCode = 1;
  });
}
