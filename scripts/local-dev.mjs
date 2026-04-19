#!/usr/bin/env node
/**
 * local-dev.mjs
 *
 * Loads .env.local from the monorepo root and starts all WhyOps services
 * concurrently with those env vars injected — so every service (including
 * the Next.js frontend) sees the same configuration.
 *
 * Usage: npm run local:dev:all
 */

import { readFileSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_FILE = resolve(ROOT, '.env.local');

// ── Guard ────────────────────────────────────────────────────────────────────
if (!existsSync(ENV_FILE)) {
  console.error('\n  [local-dev] ERROR: .env.local not found.');
  console.error(`  Expected: ${ENV_FILE}`);
  console.error('  Copy .env.example to .env.local and fill in the secrets.\n');
  process.exit(1);
}

// ── Parse .env.local ──────────────────────────────────────────────────────────
function parseEnvFile(content) {
  const vars = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // Strip inline comments (e.g. VALUE=foo  # comment)
    const commentIdx = value.search(/\s+#/);
    if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) vars[key] = value;
  }
  return vars;
}

const localVars = parseEnvFile(readFileSync(ENV_FILE, 'utf-8'));

// .env.local overrides anything already in the shell environment
Object.assign(process.env, localVars);

function getPortFromUrl(url, fallback) {
  try {
    return Number(new URL(url).port || fallback);
  } catch {
    return fallback;
  }
}

function getPidsOnPort(port) {
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out ? out.split('\n').map((pid) => pid.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function killPort(port) {
  const pids = getPidsOnPort(port);
  if (pids.length === 0) return 0;

  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGKILL');
    } catch {
      // Ignore races where the process exits between lsof and kill.
    }
  }
  return pids.length;
}

function cleanupBeforeStart() {
  const appPort = getPortFromUrl(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000', 3000);
  const ports = [
    Number(process.env.PROXY_PORT ?? 8080),
    Number(process.env.ANALYSE_PORT ?? 8081),
    Number(process.env.AUTH_PORT ?? 8082),
    appPort,
  ];

  let killed = 0;
  for (const port of ports) {
    if (Number.isFinite(port)) killed += killPort(port);
  }

  const nextLockPath = resolve(ROOT, 'apps/app/.next/dev/lock');
  rmSync(nextLockPath, { force: true });

  console.log(
    `  [local-dev] Preflight    →  cleared ${killed} process(es) on ports ${ports.join(', ')} and removed stale Next lock`,
  );
}

cleanupBeforeStart();

const set = Object.keys(localVars).length;
const empty = Object.values(localVars).filter((v) => v === '').length;

console.log(`\n  [local-dev] .env.local  →  ${set} vars loaded, ${empty} empty`);
console.log('  [local-dev] Services    →  proxy :8080  analyse :8081  auth :8082  app :3000\n');

// ── Use concurrently's programmatic API (avoids binary/yargs resolution) ─────
const require = createRequire(import.meta.url);
const { concurrently } = require(resolve(ROOT, 'node_modules/concurrently'));

const { result } = concurrently(
  [
    { command: 'npm run dev --workspace @whyops/proxy',   name: 'PROXY',   prefixColor: 'cyan'    },
    { command: 'npm run dev --workspace @whyops/analyse', name: 'ANALYSE', prefixColor: 'yellow'  },
    { command: 'npm run dev --workspace @whyops/auth',    name: 'AUTH',    prefixColor: 'green'   },
    { command: 'npm run dev --workspace @whyops/app',     name: 'APP',     prefixColor: 'magenta' },
  ],
  {
    prefix: '[{name}]',
    timestampFormat: 'HH:mm:ss',
    prefixLength: 7,
    cwd: ROOT,
  },
);

result.then(
  () => process.exit(0),
  () => process.exit(1),
);
