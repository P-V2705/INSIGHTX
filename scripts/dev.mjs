import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const children = [];
let shuttingDown = false;

function start(command, args, env = {}) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  return child;
}

function stop(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit(code);
}

const api = start(process.execPath, ['--env-file-if-exists=.env', 'server/index.js'], {
  SERVE_STATIC: 'false',
  PORT: '3001',
});
const web = start(process.execPath, [viteBin]);

api.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('[dev] The auth server stopped. Check the error above.');
    stop(code || 1);
  }
});

web.on('exit', (code) => {
  if (!shuttingDown) stop(code || 0);
});

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
