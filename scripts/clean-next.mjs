import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nextDirectory = resolve(repositoryRoot, 'apps', 'web', '.next');

try {
  await rm(nextDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200
  });
  console.log(`[clean-next] Removed ${nextDirectory}`);
} catch (error) {
  console.error(`[clean-next] Could not remove ${nextDirectory}.`);
  console.error('Stop any running Next.js dev server and retry the build.');
  console.error(error);
  process.exitCode = 1;
}
