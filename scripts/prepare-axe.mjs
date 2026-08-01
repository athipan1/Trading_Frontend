import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const AXE_VERSION = '4.11.4';
const PACKAGE_ROOT = `https://unpkg.com/axe-core@${AXE_VERSION}`;
const CACHE_DIRECTORY = path.resolve(process.cwd(), '.cache', 'axe-core');
const OUTPUT_FILE = path.join(CACHE_DIRECTORY, 'axe.min.js');

function parseIntegrity(value) {
  const separator = value.indexOf('-');
  if (separator <= 0) throw new Error(`Invalid axe integrity value: ${value}`);
  return { algorithm: value.slice(0, separator), digest: value.slice(separator + 1) };
}

function calculateDigest(buffer, algorithm) {
  return createHash(algorithm).update(buffer).digest('base64');
}

async function fetchRequired(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Unable to download axe-core: HTTP ${response.status} from ${url}`);
  return response;
}

async function main() {
  const metadataResponse = await fetchRequired(`${PACKAGE_ROOT}/?meta`);
  const metadata = await metadataResponse.json();
  if (metadata.version !== AXE_VERSION || !Array.isArray(metadata.files)) {
    throw new Error(`Unexpected axe-core metadata for version ${AXE_VERSION}`);
  }

  const fileMetadata = metadata.files.find((item) => item.path === '/axe.min.js');
  if (!fileMetadata?.integrity) throw new Error('axe.min.js integrity metadata is unavailable');

  const { algorithm, digest } = parseIntegrity(fileMetadata.integrity);
  let source;
  try {
    source = await readFile(OUTPUT_FILE);
  } catch {
    const sourceResponse = await fetchRequired(`${PACKAGE_ROOT}/axe.min.js`);
    source = Buffer.from(await sourceResponse.arrayBuffer());
  }

  const actualDigest = calculateDigest(source, algorithm);
  if (actualDigest !== digest) {
    throw new Error(`axe-core integrity mismatch: expected ${fileMetadata.integrity}`);
  }

  const banner = source.subarray(0, 1000).toString('utf8');
  if (!banner.includes(`axe v${AXE_VERSION}`)) {
    throw new Error(`axe-core version banner does not match ${AXE_VERSION}`);
  }

  await mkdir(CACHE_DIRECTORY, { recursive: true });
  await writeFile(OUTPUT_FILE, source);
  console.log(`Prepared axe-core ${AXE_VERSION} at ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
