import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const forbiddenNames = [
  'ALPACA_API_KEY_ID',
  'ALPACA_SECRET_KEY',
  'DATABASE_AGENT_API_KEY',
  'EXECUTION_API_KEY',
  'RISK_ADMIN_TOKEN',
  'DATABASE_URL',
  'postgresql://',
  'dev_execution_key',
  'dev_database_key',
];
const explicitValues = (process.env.BUNDLE_FORBIDDEN_VALUES || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length >= 8);

async function filesUnder(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    if ((await stat(fullPath)).isDirectory()) files.push(...await filesUnder(fullPath));
    else files.push(fullPath);
  }
  return files;
}

const matches = [];
for (const file of await filesUnder(root)) {
  const content = await readFile(file, 'utf8').catch(() => '');
  for (const marker of [...forbiddenNames, ...explicitValues]) {
    if (content.includes(marker)) matches.push(`${path.relative(root, file)} contains forbidden marker ${marker}`);
  }
}

if (matches.length) {
  console.error(matches.join('\n'));
  process.exit(1);
}
console.log(`Bundle secret scan passed (${(await filesUnder(root)).length} files checked).`);
