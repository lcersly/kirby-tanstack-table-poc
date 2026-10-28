import console from 'node:console';
import { appendFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const fetch = globalThis.fetch;

export function isCurrentMainCommit(candidateSha, currentMainSha) {
  return candidateSha === currentMainSha;
}

async function checkCurrentMain() {
  const { GITHUB_SHA, GITHUB_OUTPUT, GH_TOKEN } = process.env;
  if (!GITHUB_SHA || !GITHUB_OUTPUT || !GH_TOKEN) {
    throw new Error('GITHUB_SHA, GITHUB_OUTPUT, and GH_TOKEN are required.');
  }

  const response = await fetch(
    'https://api.github.com/repos/lcersly/kirby-tanstack-table-poc/commits/main',
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GH_TOKEN}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Could not read the current main revision (HTTP ${response.status}).`);
  }

  const { sha: currentMainSha } = await response.json();
  if (typeof currentMainSha !== 'string' || !/^[0-9a-f]{40}$/.test(currentMainSha)) {
    throw new Error('GitHub returned an invalid main revision.');
  }

  const isCurrent = isCurrentMainCommit(GITHUB_SHA, currentMainSha);
  appendFileSync(GITHUB_OUTPUT, `is_current=${isCurrent}\n`);
  if (!isCurrent) {
    console.info('Rejecting deployment of a superseded main revision.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  checkCurrentMain().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Current-main check failed.');
    process.exitCode = 1;
  });
}
