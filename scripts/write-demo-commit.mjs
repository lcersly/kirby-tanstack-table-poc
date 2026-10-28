import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();
const shortCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();
const kirbyPackagePath = resolve(repoRoot, 'node_modules/@kirbydesign/designsystem/package.json');
const kirbyPackage = JSON.parse(readFileSync(kirbyPackagePath, 'utf8'));

if (
  typeof kirbyPackage !== 'object' ||
  kirbyPackage === null ||
  typeof kirbyPackage.version !== 'string'
) {
  throw new Error(`Missing installed Kirby version in ${kirbyPackagePath}.`);
}
const generatedFile = resolve(repoRoot, 'src/app/prototype/demo-commit.generated.ts');

writeFileSync(
  generatedFile,
  [
    `export const DEMO_COMMIT = ${JSON.stringify(shortCommit)};`,
    `export const KIRBY_VERSION = ${JSON.stringify(kirbyPackage.version)};`,
    '',
  ].join('\n'),
);
writeFileSync(
  resolve(repoRoot, 'public/demo-version.json'),
  `${JSON.stringify({ sourceCommit, shortCommit, kirbyVersion: kirbyPackage.version }, null, 2)}\n`,
);
