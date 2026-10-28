import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

function requiredEnvironmentValue(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required GitHub Actions environment variable: ${name}`);
  }

  return value;
}

const sourceCommit = requiredEnvironmentValue('GITHUB_SHA');
const repository = requiredEnvironmentValue('GITHUB_REPOSITORY');
const workflow = requiredEnvironmentValue('GITHUB_WORKFLOW');
const eventName = requiredEnvironmentValue('GITHUB_EVENT_NAME');
const ref = requiredEnvironmentValue('GITHUB_REF');
const runId = requiredEnvironmentValue('GITHUB_RUN_ID');
const runAttempt = requiredEnvironmentValue('GITHUB_RUN_ATTEMPT');
const serverUrl = requiredEnvironmentValue('GITHUB_SERVER_URL');

if (eventName !== 'push' || ref !== 'refs/heads/main') {
  throw new Error('Artifact provenance can only be written for a push to main.');
}

const checkedOutCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();

if (checkedOutCommit !== sourceCommit) {
  throw new Error(
    `Checked-out commit ${checkedOutCommit} does not match workflow source ${sourceCommit}.`,
  );
}

const browserOutput = resolve(repoRoot, 'dist/kirby-payment-overview-prototype/browser');
const shortCommit = execFileSync('git', ['rev-parse', '--short', sourceCommit], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();
const provenance = {
  repository,
  workflow,
  eventName,
  ref,
  runId,
  runAttempt,
  runUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
  sourceCommit,
  shortCommit,
};

writeFileSync(
  resolve(browserOutput, 'artifact-provenance.json'),
  `${JSON.stringify(provenance, null, 2)}\n`,
);
