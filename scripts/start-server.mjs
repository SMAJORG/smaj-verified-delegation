import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Run on the same host so web approval and the durable worker use one SQLite
// volume. Hosting can keep its existing `npm start` command.
let stopping = false;
const children = [
  spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), '--tsconfig', 'tsconfig.json', 'scripts/worker.ts'], { stdio: 'inherit', env: process.env }),
];
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill(signal);
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop(signal));
for (const child of children) {
  child.on('error', () => { console.error('Web/worker process could not start'); process.exitCode = 1; stop(); });
  child.on('exit', code => {
    if (!stopping) { console.error('Web/worker process exited unexpectedly'); process.exitCode = code || 1; stop(); }
  });
}
