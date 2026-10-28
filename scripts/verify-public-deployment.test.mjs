import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';

import { verifyPublicDeployment } from './verify-public-deployment.mjs';

const siteUrl = new URL('https://kirby-tanstack-table-poc.web.app/');
const expectedIdentity = {
  sourceCommit: '0f3afc2b3d527246947d015d625eebc215cb6129',
  shortCommit: '0f3afc2',
  kirbyVersion: '12.0.0',
};
const html = '<app-root></app-root><script src="/main.js" type="module"></script>';

function createFetch(identity = expectedIdentity) {
  const files = new Map([
    ['/', html],
    ['/prototype/payment-overview', html],
    ['/demo-version.json', JSON.stringify(identity)],
    ['/main.js', 'loadComponent:()=>import("./payment.js")'],
    ['/payment.js', 'const demo="0f3afc2";const kirby="12.0.0";const labels="Kirby Demo "'],
  ]);
  const requestedPaths = [];

  return {
    requestedPaths,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname;
      requestedPaths.push(path);
      const body = files.get(path);
      return {
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        headers: {
          get: () => (path.endsWith('.js') ? 'text/javascript' : 'text/html'),
        },
        text: async () => body,
        json: async () => JSON.parse(body),
      };
    },
  };
}

test('verifies public root, payment route, marker, and lazy-loaded app code', async () => {
  const { fetchImpl, requestedPaths } = createFetch();

  await verifyPublicDeployment({ siteUrl, expectedIdentity, fetchImpl });

  assert.ok(requestedPaths.includes('/'));
  assert.ok(requestedPaths.includes('/prototype/payment-overview'));
  assert.ok(requestedPaths.includes('/payment.js'));
});

test('rejects a public release marker from a different checked artifact', async () => {
  const { fetchImpl } = createFetch({ ...expectedIdentity, shortCommit: 'different' });

  await assert.rejects(
    verifyPublicDeployment({ siteUrl, expectedIdentity, fetchImpl }),
    /does not match the checked CI artifact/,
  );
});
