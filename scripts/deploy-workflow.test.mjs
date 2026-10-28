import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { isCurrentMainCommit } from './check-current-main.mjs';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('only successful main push verification can reach the deployment job', () => {
  assert.match(
    workflow,
    /deploy:\n\s+if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\n\s+needs: verify/,
  );
  assert.match(
    workflow,
    /Upload checked production browser\n\s+if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && success\(\)/,
  );

  const deployJob = workflow.slice(workflow.indexOf('\n  deploy:'));
  const verifyJob = workflow.slice(
    workflow.indexOf('\n  verify:'),
    workflow.indexOf('\n  deploy:'),
  );
  assert.doesNotMatch(verifyJob, /FIREBASE_SERVICE_ACCOUNT|secrets\./);
  assert.match(
    deployJob,
    /FIREBASE_SERVICE_ACCOUNT: \$\{\{ secrets\.FIREBASE_SERVICE_ACCOUNT \}\}/,
  );
});

test('deployment concurrency prevents overlap and cancellation', () => {
  const deployJob = workflow.slice(workflow.indexOf('\n  deploy:'));

  assert.match(
    deployJob,
    /concurrency:\n\s+group: firebase-hosting-live\n\s+cancel-in-progress: false/,
  );
});

test('the deployment job checks current main before using its credential', () => {
  const deployJob = workflow.slice(workflow.indexOf('\n  deploy:'));

  assert.ok(
    deployJob.indexOf('Check that this revision is still current') <
      deployJob.indexOf('FIREBASE_SERVICE_ACCOUNT:'),
  );
  assert.match(deployJob, /if: steps\.current\.outputs\.is_current == 'true'/);
  assert.match(deployJob, /run: node scripts\/check-current-main\.mjs/);
});

test('the freshness check rejects a queued commit after main advances', () => {
  const oldMain = '0'.repeat(40);
  const newMain = '1'.repeat(40);

  assert.equal(isCurrentMainCommit(oldMain, newMain), false);
  assert.equal(isCurrentMainCommit(newMain, newMain), true);
});

test('the package scripts expose no local Firebase publishing command', () => {
  assert.equal(
    Object.values(packageJson.scripts).some(
      (script) => script.includes('firebase-tools') && script.includes('deploy'),
    ),
    false,
  );
  assert.equal(
    existsSync(new URL('../.github/workflows/deploy-firebase.yml', import.meta.url)),
    false,
  );
});
