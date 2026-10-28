import console from 'node:console';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

export async function verifyPublicDeployment({
  siteUrl,
  expectedSourceSha,
  expectedCommit,
  expectedKirbyVersion,
  fetchImpl = globalThis.fetch,
}) {
  const requiredValues = [
    ['expected source SHA', expectedSourceSha],
    ['expected commit', expectedCommit],
    ['expected Kirby version', expectedKirbyVersion],
  ];

  for (const [name, value] of requiredValues) {
    if (!value) {
      throw new Error(`Missing required public deployment value: ${name}.`);
    }
  }

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
    identity.sourceCommit !== expectedSourceSha ||
    identity.shortCommit !== expectedCommit ||
    identity.kirbyVersion !== expectedKirbyVersion
  ) {
    throw new Error('The public release identity does not match the selected CI artifact.');
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
    !applicationCode.includes(expectedCommit) ||
    !applicationCode.includes(expectedKirbyVersion) ||
    !applicationCode.includes('Kirby ') ||
    !applicationCode.includes('Demo ')
  ) {
    throw new Error(
      'The public release does not contain the visible selected commit and Kirby version.',
    );
  }
}

async function runCli() {
  await verifyPublicDeployment({
    siteUrl: new URL('https://kirby-tanstack-table-poc.web.app/'),
    expectedSourceSha: process.env.EXPECTED_SOURCE_SHA,
    expectedCommit: process.env.EXPECTED_COMMIT,
    expectedKirbyVersion: process.env.EXPECTED_KIRBY_VERSION,
  });
  console.info(
    `Verified unauthenticated root and payment deep link for commit ${process.env.EXPECTED_COMMIT} with Kirby ${process.env.EXPECTED_KIRBY_VERSION}.`,
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
