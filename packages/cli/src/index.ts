#!/usr/bin/env node
import { intro, outro, select, text, password, spinner, note, cancel, isCancel } from '@clack/prompts';
import pc from 'picocolors';
import { execSync, spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const API_PORT = 3001;
const MCP_PORT = 3002;
const API_URL = `http://localhost:${API_PORT}`;
const MCP_URL = `http://localhost:${MCP_PORT}/mcp`;

// ── ASCII banner ──────────────────────────────────────────────────────────────

function banner(): void {
  console.log('');
  console.log(pc.cyan('  ████████╗███████╗███╗  ██╗██████╗  ██████╗ ███╗  ██╗'));
  console.log(pc.cyan('     ██╔══╝██╔════╝████╗ ██║██╔══██╗██╔═══██╗████╗ ██║'));
  console.log(pc.cyan('     ██║   █████╗  ██╔██╗██║██║  ██║██║   ██║██╔██╗██║'));
  console.log(pc.cyan('     ██║   ██╔══╝  ██║╚██╗██║██║  ██║██║   ██║██║╚██╗██║'));
  console.log(pc.cyan('     ██║   ███████╗██║ ╚████║██████╔╝╚██████╔╝██║ ╚████║'));
  console.log(pc.cyan('     ╚═╝   ╚══════╝╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝'));
  console.log('');
  console.log(pc.dim('  Task tracking that lives inside Claude Code'));
  console.log('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasDocker(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasDockerCompose(): boolean {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync('docker-compose version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

function composeCmd(): string {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch {
    return 'docker-compose';
  }
}

async function waitForApi(maxWaitMs = 45_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function register(email: string, name: string, pass: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password: pass }),
    });
    return res.ok || res.status === 409; // 409 = already exists, that's fine
  } catch {
    return false;
  }
}

// ── Flows ─────────────────────────────────────────────────────────────────────

async function flowDocker(email: string, name: string, pass: string): Promise<void> {
  const s = spinner();

  // Write .env for docker compose
  const envPath = join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) {
    const jwtSecret = randomBytes(32).toString('hex');
    writeFileSync(envPath, `JWT_SECRET=${jwtSecret}\n`);
  }

  s.start('Starting services with Docker Compose…');
  try {
    execSync(`${composeCmd()} up -d --build`, {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
  } catch {
    s.stop(pc.red('Failed to start Docker Compose'));
    note(
      'Make sure Docker Desktop is running and try again.\n' +
      `cd ${REPO_ROOT} && docker compose up`,
      'Manual start',
    );
    return;
  }
  s.stop('Services started');

  s.start('Waiting for API to be ready…');
  const ready = await waitForApi();
  if (!ready) {
    s.stop(pc.red('API did not start in time'));
    note('Check logs with: docker compose logs api', 'Debug');
    return;
  }
  s.stop('API is ready');

  s.start('Creating your account…');
  const ok = await register(email, name, pass);
  s.stop(ok ? 'Account created' : pc.yellow('Account already exists — continuing'));

  printSuccess(email);
}

async function flowManual(
  dbUrl: string,
  email: string,
  name: string,
  pass: string,
): Promise<void> {
  const s = spinner();

  // Write env for API
  const apiEnvPath = join(REPO_ROOT, 'packages', 'api', '.env');
  const jwtSecret = randomBytes(32).toString('hex');
  const envContent = [
    `DATABASE_URL=${dbUrl}`,
    `JWT_SECRET=${jwtSecret}`,
    `PORT=${API_PORT}`,
    `API_BASE_URL=${API_URL}`,
    `WEB_BASE_URL=${API_URL}`,
    `MCP_BASE_URL=${MCP_URL}`,
    `CORS_ORIGINS=http://localhost:3000`,
    `NODE_ENV=production`,
  ].join('\n');
  writeFileSync(apiEnvPath, envContent);

  const mcpEnvPath = join(REPO_ROOT, 'packages', 'mcp', '.env');
  writeFileSync(mcpEnvPath, `ALASHED_API_URL=${API_URL}\nMCP_BASE_URL=${MCP_URL}\nPORT=${MCP_PORT}\n`);

  // Build if needed
  s.start('Building packages…');
  try {
    execSync('npm run build:shared && npm run build:api && npm run build:mcp', {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
  } catch {
    s.stop(pc.red('Build failed'));
    return;
  }
  s.stop('Build complete');

  // Run migrations
  s.start('Running database migrations…');
  try {
    execSync('node dist/scripts/migrate.js', {
      cwd: join(REPO_ROOT, 'packages', 'api'),
      stdio: 'ignore',
    });
  } catch {
    s.stop(pc.red('Migration failed — check your DATABASE_URL'));
    return;
  }
  s.stop('Migrations complete');

  // Start API
  s.start('Starting API…');
  const apiProc = spawn('node', ['dist/server.js'], {
    cwd: join(REPO_ROOT, 'packages', 'api'),
    detached: true,
    stdio: 'ignore',
  });
  apiProc.unref();

  // Start MCP
  const mcpProc = spawn('node', ['dist/index.js'], {
    cwd: join(REPO_ROOT, 'packages', 'mcp'),
    detached: true,
    stdio: 'ignore',
  });
  mcpProc.unref();

  const ready = await waitForApi();
  if (!ready) {
    s.stop(pc.red('API did not start'));
    return;
  }
  s.stop('Services started');

  s.start('Creating your account…');
  const ok = await register(email, name, pass);
  s.stop(ok ? 'Account created' : pc.yellow('Account already exists — continuing'));

  // Save PID file
  const pidDir = join(REPO_ROOT, '.tendon');
  mkdirSync(pidDir, { recursive: true });
  writeFileSync(
    join(pidDir, 'pids.json'),
    JSON.stringify({ api: apiProc.pid, mcp: mcpProc.pid }, null, 2),
  );

  printSuccess(email);
}

function printSuccess(email: string): void {
  console.log('');
  note(
    [
      pc.bold('Run this command in your terminal:'),
      '',
      pc.cyan(`  claude mcp add --transport http tendon ${MCP_URL}`),
      '',
      `Then open Claude Code and say: ${pc.yellow('"start my day"')}`,
      '',
      pc.dim(`Signed in as: ${email}`),
      pc.dim(`Dashboard:    ${API_URL}`),
    ].join('\n'),
    pc.green('✓ Tendon is running'),
  );
}

// ── whoami subcommand (no TTY required) ───────────────────────────────────────

const HOSTED_API = 'https://api.tendon.alashed.kz';
const HOSTED_MCP = 'https://mcp.tendon.alashed.kz/mcp';

async function cmdWhoami(): Promise<void> {
  console.log('');
  console.log(pc.cyan('  Tendon connection check'));
  console.log('');

  let localOk = false;
  try {
    const r = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
    localOk = r.ok;
  } catch { /* ignore */ }

  let hostedOk = false;
  let hostedHealth: { clerkConfigured?: boolean } | null = null;
  try {
    const r = await fetch(`${HOSTED_API}/health`, { signal: AbortSignal.timeout(8000) });
    hostedOk = r.ok;
    if (r.ok) hostedHealth = (await r.json()) as { clerkConfigured?: boolean };
  } catch { /* ignore */ }

  const mcpUrl = localOk ? MCP_URL : HOSTED_MCP;

  if (localOk) {
    console.log(pc.green('  ✓ Local API running') + pc.dim(` (${API_URL})`));
  } else if (hostedOk) {
    console.log(pc.green('  ✓ Hosted API reachable') + pc.dim(` (${HOSTED_API})`));
    if (hostedHealth?.clerkConfigured === false) {
      console.log(pc.yellow('  ⚠ API: Clerk not configured (contact support)'));
    }
  } else {
    console.log(pc.red('  ✗ No Tendon API reachable'));
    console.log(pc.dim('    Local: ') + API_URL);
    console.log(pc.dim('    Hosted: ') + HOSTED_API);
    console.log('');
    console.log(pc.dim('  Check: ') + pc.cyan('curl https://api.tendon.alashed.kz/health'));
    console.log(pc.dim('  Or run ') + pc.cyan('npx tendon-cli') + pc.dim(' to set up locally.'));
    process.exit(1);
  }

  console.log('');
  console.log(pc.bold('  Connect to Claude Code'));
  console.log('');
  console.log(pc.dim('  If tendon is not added yet:'));
  console.log(pc.cyan(`    claude mcp add --transport http tendon ${mcpUrl}`));
  console.log('');
  console.log(pc.dim('  Then restart Claude Code and say: ') + pc.cyan('"start my day"'));
  console.log(pc.dim('  → Browser opens for login'));
  console.log('');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const sub = process.argv[2];
  if (sub === 'whoami') {
    await cmdWhoami();
    return;
  }

  banner();
  intro(pc.bold('Tendon setup'));

  const mode = await select({
    message: 'How do you want to run Tendon?',
    options: [
      {
        value: 'docker',
        label: 'Docker  (recommended — PostgreSQL included)',
        hint: 'requires Docker Desktop',
      },
      {
        value: 'manual',
        label: 'Manual  (bring your own PostgreSQL)',
        hint: 'runs API + MCP as background processes',
      },
      {
        value: 'cloud',
        label: 'Cloud   (tendon.alashed.kz — free account)',
        hint: 'full dashboard, team features, no install',
      },
    ],
  });

  if (isCancel(mode)) { cancel('Setup cancelled'); process.exit(0); }

  if (mode === 'cloud') {
    note(
      [
        `1. Go to ${pc.cyan('https://tendon.alashed.kz/register')}`,
        '2. Create a free account',
        '3. Run the command shown on the onboarding page',
        '',
        pc.dim('No server setup required. Full dashboard, team features,'),
        pc.dim('Telegram reports, and more.'),
      ].join('\n'),
      'Use the hosted version',
    );
    outro(pc.dim('See you at tendon.alashed.kz!'));
    return;
  }

  if (mode === 'docker' && !hasDocker()) {
    note(
      'Docker is not running or not installed.\n' +
      'Download it from: https://www.docker.com/products/docker-desktop',
      pc.yellow('Docker not found'),
    );
    cancel('Please install Docker and try again');
    process.exit(1);
  }

  if (mode === 'docker' && !hasDockerCompose()) {
    note('docker compose plugin not found', pc.yellow('Missing dependency'));
    cancel('Please update Docker Desktop and try again');
    process.exit(1);
  }

  let dbUrl = '';
  if (mode === 'manual') {
    const result = await text({
      message: 'PostgreSQL connection URL',
      placeholder: 'postgresql://user:pass@localhost:5432/tendon',
      validate: (v) => (!v.startsWith('postgres') ? 'Must be a PostgreSQL URL' : undefined),
    });
    if (isCancel(result)) { cancel(); process.exit(0); }
    dbUrl = result;
  }

  const emailResult = await text({
    message: 'Your email',
    placeholder: 'you@example.com',
    validate: (v) => (!v.includes('@') ? 'Enter a valid email' : undefined),
  });
  if (isCancel(emailResult)) { cancel(); process.exit(0); }

  const nameResult = await text({
    message: 'Your name',
    placeholder: 'Nurdaulet',
    validate: (v) => (!v.trim() ? 'Name is required' : undefined),
  });
  if (isCancel(nameResult)) { cancel(); process.exit(0); }

  const passResult = await password({
    message: 'Password (min 8 chars)',
    validate: (v) => (v.length < 8 ? 'Password must be at least 8 characters' : undefined),
  });
  if (isCancel(passResult)) { cancel(); process.exit(0); }

  console.log('');

  if (mode === 'docker') {
    await flowDocker(emailResult, nameResult, passResult);
  } else {
    await flowManual(dbUrl, emailResult, nameResult, passResult);
  }

  outro(pc.dim('To stop: docker compose down  (or kill the background processes)'));
}

main().catch((err) => {
  console.error(pc.red('Unexpected error:'), err.message);
  process.exit(1);
});
