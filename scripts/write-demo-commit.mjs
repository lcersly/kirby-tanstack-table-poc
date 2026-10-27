import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();
const generatedFile = resolve(
  repoRoot,
  'src/app/prototype/demo-commit.generated.ts',
);

writeFileSync(
  generatedFile,
  `export const DEMO_COMMIT = '${commit}';\n`,
);
