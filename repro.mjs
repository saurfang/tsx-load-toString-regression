import { spawnSync } from 'node:child_process';

function run(binPath, label) {
  console.log(`--- ${label} ---`);
  const { stdout, stderr } = spawnSync('node', [binPath, 'entry.mjs'], { encoding: 'utf8' });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return stdout + stderr;
}

const expected = 'm.value:  42';

const working = run('node_modules/tsx-working/dist/cli.mjs', 'tsx 4.21.0 (expected: works)');
console.log();
const broken  = run('node_modules/tsx-broken/dist/cli.mjs',  'tsx 4.22.2 (expected: broken)');
console.log();

if (!working.includes(expected)) {
  console.error('::error::Sanity check failed: tsx 4.21.0 did not return expected output.');
  process.exit(2);
}

if (broken.includes(expected)) {
  console.log('✅ tsx 4.22.2 returned correct output — the bug appears to be fixed!');
  process.exit(0);
}

console.error('❌ TSX BUG CONFIRMED: tsx 4.22.2 returned an empty namespace instead of `{ value: 42 }`.');
console.error('   See https://github.com/saurfang/tsx-load-toString-regression for details.');
process.exit(1);
