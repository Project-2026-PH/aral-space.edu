import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const webPublicDir = path.resolve(rootDir, 'apps', 'web', 'public');
const versionFilePath = path.join(webPublicDir, 'version.json');

export function resolveAppVersion() {
  if (process.env.NEXT_PUBLIC_APP_VERSION?.trim()) {
    return process.env.NEXT_PUBLIC_APP_VERSION.trim();
  }
  if (process.env.VERCEL_GIT_COMMIT_SHA?.trim()) {
    return process.env.VERCEL_GIT_COMMIT_SHA.trim().slice(0, 7);
  }
  if (process.env.GITHUB_SHA?.trim()) {
    return process.env.GITHUB_SHA.trim().slice(0, 7);
  }
  if (process.env.COMMIT_REF?.trim()) {
    return process.env.COMMIT_REF.trim().slice(0, 7);
  }
  try {
    const commitHash = execSync('git rev-parse --short HEAD', {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (commitHash) return commitHash;
  } catch {
    // git not available or detached
  }
  return Date.now().toString(36);
}

export function writeVersionFile() {
  const version = resolveAppVersion();
  const payload = {
    version,
    builtAt: new Date().toISOString(),
  };

  if (!fs.existsSync(webPublicDir)) {
    fs.mkdirSync(webPublicDir, { recursive: true });
  }

  fs.writeFileSync(versionFilePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[version] Generated public/version.json -> version: ${version} (${payload.builtAt})`);
  return payload;
}

// Run directly if invoked via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  writeVersionFile();
}
