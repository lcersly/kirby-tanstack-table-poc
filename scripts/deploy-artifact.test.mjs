import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';

import {
  resolveCiArtifact,
  validateArtifactProvenance,
  validatePublicBuildIdentity,
} from './deploy-artifact.mjs';
import { verifyPublicDeployment } from './verify-public-deployment.mjs';

const repository = 'lcersly/kirby-tanstack-table-poc';
const sourceSha = '0f3afc2b3d527246947d015d625eebc215cb6129';
const runUrl = 'https://github.com/lcersly/kirby-tanstack-table-poc/actions/runs/40657118272';

function createProvenance(overrides = {}) {
  return {
    repository,
    workflow: 'CI',
    eventName: 'push',
    ref: 'refs/heads/main',
    runId: '40657118272',
    runAttempt: '1',
    runUrl,
    sourceCommit: sourceSha,
    shortCommit: sourceSha.slice(0, 7),
    kirbyVersion: '12.0.0',
    ...overrides,
  };
}

function createFetch(responses) {
  const requestedUrls = [];

  return {
    requestedUrls,
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      requestedUrls.push(new URL(url).pathname + new URL(url).search);
      const body = responses.shift();
      assert.ok(body, 'unexpected GitHub API request');
      return {
        ok: true,
        status: 200,
        json: async () => body,
      };
    },
  };
}

test('resolves only the successful artifact for the current main commit', async () => {
  const { fetchImpl, requestedUrls } = createFetch([
    { sha: sourceSha },
    {
      workflow_runs: [
        {
          id: 40657118272,
          run_attempt: 1,
          run_number: 14,
          name: 'CI',
          path: '.github/workflows/ci.yml',
          event: 'push',
          head_branch: 'main',
          head_sha: sourceSha,
          status: 'completed',
          conclusion: 'success',
        },
      ],
    },
    {
      artifacts: [
        {
          id: 98765,
          name: `payment-demo-${sourceSha}`,
          expired: false,
        },
      ],
    },
  ]);

  const result = await resolveCiArtifact({
    repository,
    ref: 'refs/heads/main',
    sha: sourceSha,
    workflowSha: sourceSha,
    token: 'test-token',
    fetchImpl,
  });

  assert.deepEqual(result, {
    artifactId: 98765,
    runAttempt: 1,
    runId: 40657118272,
  });
  assert.equal(requestedUrls.length, 3);
});

test('rejects a selected source revision that is no longer main', async () => {
  const { fetchImpl, requestedUrls } = createFetch([
    { sha: '1111111111111111111111111111111111111111' },
  ]);

  await assert.rejects(
    resolveCiArtifact({
      repository,
      ref: 'refs/heads/main',
      sha: sourceSha,
      workflowSha: sourceSha,
      token: 'test-token',
      fetchImpl,
    }),
    /no longer the latest commit on main/,
  );
  assert.equal(requestedUrls.length, 1);
});

test('rejects pull-request provenance even when the source SHA matches', () => {
  assert.throws(
    () =>
      validateArtifactProvenance(createProvenance({ eventName: 'pull_request' }), {
        repository,
        runId: 40657118272,
        runAttempt: 1,
        serverUrl: 'https://github.com',
        sourceSha,
      }),
    /does not match the selected successful CI run/,
  );
});

test('validates matching main provenance and returns public build identity', () => {
  const result = validateArtifactProvenance(createProvenance(), {
    repository,
    runId: 40657118272,
    runAttempt: 1,
    serverUrl: 'https://github.com',
    sourceSha,
  });

  assert.deepEqual(result, {
    kirbyVersion: '12.0.0',
    shortCommit: sourceSha.slice(0, 7),
    sourceCommit: sourceSha,
  });
});

test('requires the public build marker to match checked artifact provenance', () => {
  assert.doesNotThrow(() =>
    validatePublicBuildIdentity(
      {
        sourceCommit: sourceSha,
        shortCommit: sourceSha.slice(0, 7),
        kirbyVersion: '12.0.0',
      },
      {
        sourceCommit: sourceSha,
        shortCommit: sourceSha.slice(0, 7),
        kirbyVersion: '12.0.0',
      },
    ),
  );

  assert.throws(
    () =>
      validatePublicBuildIdentity(
        {
          sourceCommit: sourceSha,
          shortCommit: sourceSha.slice(0, 7),
          kirbyVersion: '12.0.0',
        },
        {
          sourceCommit: sourceSha,
          shortCommit: sourceSha.slice(0, 7),
          kirbyVersion: '12.0.1',
        },
      ),
    /does not match the checked CI artifact/,
  );
});

test('verifies the public app shell and build identity in its lazy-loaded route', async () => {
  const html = '<app-root></app-root><script src="/main.js" type="module"></script>';
  const files = new Map([
    ['/', html],
    ['/prototype/payment-overview', html],
    [
      '/demo-version.json',
      JSON.stringify({
        sourceCommit: sourceSha,
        shortCommit: '0f3afc2',
        kirbyVersion: '12.0.0',
      }),
    ],
    ['/main.js', 'loadComponent:()=>import("./payment.js")'],
    ['/payment.js', 'const demo="0f3afc2";const kirby="12.0.0";const labels="Kirby Demo "'],
  ]);
  const requestedPaths = [];

  await verifyPublicDeployment({
    siteUrl: new URL('https://kirby-tanstack-table-poc.web.app/'),
    expectedSourceSha: sourceSha,
    expectedCommit: '0f3afc2',
    expectedKirbyVersion: '12.0.0',
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
  });

  assert.ok(requestedPaths.includes('/prototype/payment-overview'));
  assert.ok(requestedPaths.includes('/payment.js'));
});
