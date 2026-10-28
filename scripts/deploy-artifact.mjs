import { appendFileSync, readFileSync } from 'node:fs';
import console from 'node:console';
import { resolve } from 'node:path';
import process from 'node:process';
import { URL, URLSearchParams } from 'node:url';
import { fileURLToPath } from 'node:url';

const expectedRepository = 'lcersly/kirby-tanstack-table-poc';
const expectedWorkflowPath = '.github/workflows/ci.yml';
const expectedWorkflowName = 'CI';
const expectedArtifactName = (sha) => `payment-demo-${sha}`;
const apiBase = process.env.GITHUB_API_URL ?? 'https://api.github.com';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredValue(value, name) {
  if (!value) {
    throw new Error(`Missing required deployment value: ${name}.`);
  }

  return value;
}

function validateSourceContext({ repository, ref, sha, workflowSha }) {
  if (repository !== expectedRepository) {
    throw new Error(`Deployment is restricted to ${expectedRepository}.`);
  }

  if (ref !== 'refs/heads/main') {
    throw new Error('Deployment is restricted to a workflow run on main.');
  }

  if (!/^[0-9a-f]{40}$/.test(sha) || sha !== workflowSha) {
    throw new Error('The selected source SHA must match the full workflow source SHA.');
  }
}

async function getJson(path, token, fetchImpl) {
  const base = `${apiBase.replace(/\/+$/, '')}/`;
  const url = new URL(path.replace(/^\/+/, ''), base);
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed with HTTP ${response.status}: ${url.pathname}.`);
  }

  return response.json();
}

async function assertCurrentMain({ repository, sha, token, fetchImpl = globalThis.fetch }) {
  const currentMain = await getJson(`repos/${repository}/commits/main`, token, fetchImpl);

  if (!isRecord(currentMain) || currentMain.sha !== sha) {
    throw new Error('The selected source revision is no longer the latest commit on main.');
  }
}

export async function resolveCiArtifact({
  repository,
  ref,
  sha,
  workflowSha,
  token,
  fetchImpl = globalThis.fetch,
}) {
  validateSourceContext({ repository, ref, sha, workflowSha });
  await assertCurrentMain({ repository, sha, token, fetchImpl });

  const query = new URLSearchParams({
    head_sha: sha,
    event: 'push',
    per_page: '100',
  });
  const runResponse = await getJson(
    `repos/${repository}/actions/workflows/ci.yml/runs?${query}`,
    token,
    fetchImpl,
  );

  if (!isRecord(runResponse) || !Array.isArray(runResponse.workflow_runs)) {
    throw new Error('GitHub returned an invalid CI workflow-run response.');
  }

  const successfulRuns = runResponse.workflow_runs
    .filter(
      (run) =>
        isRecord(run) &&
        run.path === expectedWorkflowPath &&
        run.name === expectedWorkflowName &&
        run.event === 'push' &&
        run.head_branch === 'main' &&
        run.head_sha === sha &&
        run.status === 'completed' &&
        run.conclusion === 'success' &&
        Number.isSafeInteger(run.id) &&
        Number.isSafeInteger(run.run_attempt),
    )
    .sort(
      (left, right) => right.run_number - left.run_number || right.run_attempt - left.run_attempt,
    );

  if (successfulRuns.length === 0) {
    throw new Error('No successful main CI run exists for the selected source revision.');
  }

  const run = successfulRuns[0];
  const artifactResponse = await getJson(
    `repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`,
    token,
    fetchImpl,
  );

  if (!isRecord(artifactResponse) || !Array.isArray(artifactResponse.artifacts)) {
    throw new Error('GitHub returned an invalid CI artifact response.');
  }

  const artifacts = artifactResponse.artifacts.filter(
    (artifact) =>
      isRecord(artifact) &&
      artifact.name === expectedArtifactName(sha) &&
      artifact.expired === false &&
      Number.isSafeInteger(artifact.id),
  );

  if (artifacts.length !== 1) {
    throw new Error(
      'The successful CI run does not have one available artifact for this source SHA.',
    );
  }

  return {
    artifactId: artifacts[0].id,
    runAttempt: run.run_attempt,
    runId: run.id,
  };
}

export function validateArtifactProvenance(provenance, expected) {
  if (!isRecord(provenance)) {
    throw new Error('The CI artifact provenance file is not a JSON object.');
  }

  const expectedRunUrl = `${expected.serverUrl}/${expected.repository}/actions/runs/${expected.runId}`;
  const valid =
    provenance.repository === expected.repository &&
    provenance.workflow === expectedWorkflowName &&
    provenance.eventName === 'push' &&
    provenance.ref === 'refs/heads/main' &&
    provenance.runId === String(expected.runId) &&
    provenance.runAttempt === String(expected.runAttempt) &&
    provenance.runUrl === expectedRunUrl &&
    provenance.sourceCommit === expected.sourceSha &&
    typeof provenance.shortCommit === 'string' &&
    /^[0-9a-f]{7,40}$/.test(provenance.shortCommit) &&
    expected.sourceSha.startsWith(provenance.shortCommit) &&
    typeof provenance.kirbyVersion === 'string' &&
    /^[0-9A-Za-z.+-]+$/.test(provenance.kirbyVersion);

  if (!valid) {
    throw new Error(
      'The downloaded artifact provenance does not match the selected successful CI run.',
    );
  }

  return {
    kirbyVersion: provenance.kirbyVersion,
    shortCommit: provenance.shortCommit,
    sourceCommit: provenance.sourceCommit,
  };
}

export function validatePublicBuildIdentity(identity, expected) {
  if (
    !isRecord(identity) ||
    identity.sourceCommit !== expected.sourceCommit ||
    identity.shortCommit !== expected.shortCommit ||
    identity.kirbyVersion !== expected.kirbyVersion
  ) {
    throw new Error('The public build identity does not match the checked CI artifact.');
  }
}

function writeOutputs(values) {
  const outputPath = requiredValue(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT');
  const lines = Object.entries(values).map(([name, value]) => `${name}=${value}`);
  appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

function deploymentContext() {
  const repository = requiredValue(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
  const sha = requiredValue(process.env.SOURCE_SHA, 'SOURCE_SHA');
  const token = requiredValue(process.env.GH_TOKEN, 'GH_TOKEN');

  validateSourceContext({
    repository,
    ref: requiredValue(process.env.GITHUB_REF, 'GITHUB_REF'),
    sha,
    workflowSha: requiredValue(process.env.GITHUB_SHA, 'GITHUB_SHA'),
  });

  return { repository, sha, token };
}

async function runCli() {
  const mode = process.argv[2];
  const context = deploymentContext();

  if (mode === 'resolve') {
    const artifact = await resolveCiArtifact({
      ...context,
      ref: process.env.GITHUB_REF,
      workflowSha: process.env.GITHUB_SHA,
    });
    writeOutputs({
      artifact_id: artifact.artifactId,
      run_attempt: artifact.runAttempt,
      run_id: artifact.runId,
    });
    return;
  }

  if (mode === 'check-current') {
    await assertCurrentMain(context);
    console.info(`Confirmed ${context.sha} is still the latest main revision.`);
    return;
  }

  if (mode === 'validate') {
    const provenancePath = resolve(
      'dist/kirby-payment-overview-prototype/artifact-provenance.json',
    );
    const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
    const validated = validateArtifactProvenance(provenance, {
      repository: context.repository,
      runId: requiredValue(process.env.CI_RUN_ID, 'CI_RUN_ID'),
      runAttempt: requiredValue(process.env.CI_RUN_ATTEMPT, 'CI_RUN_ATTEMPT'),
      serverUrl: requiredValue(process.env.GITHUB_SERVER_URL, 'GITHUB_SERVER_URL'),
      sourceSha: context.sha,
    });
    const publicIdentityPath = resolve(
      'dist/kirby-payment-overview-prototype/browser/demo-version.json',
    );
    const publicIdentity = JSON.parse(readFileSync(publicIdentityPath, 'utf8'));
    validatePublicBuildIdentity(publicIdentity, {
      sourceCommit: context.sha,
      shortCommit: validated.shortCommit,
      kirbyVersion: validated.kirbyVersion,
    });
    writeOutputs({
      kirby_version: validated.kirbyVersion,
      short_commit: validated.shortCommit,
      source_commit: validated.sourceCommit,
    });
    console.info(`Validated CI artifact for ${validated.shortCommit}.`);
    return;
  }

  throw new Error('Expected deployment-artifact mode: resolve, validate, or check-current.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Deployment artifact validation failed.',
    );
    process.exitCode = 1;
  });
}
