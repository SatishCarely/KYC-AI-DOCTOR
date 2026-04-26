import 'dotenv/config';
import { spawn } from 'child_process';

if (!process.env.BEY_API_KEY && process.env.BEYOND_PRESENCE_API_KEY) {
  process.env.BEY_API_KEY = process.env.BEYOND_PRESENCE_API_KEY;
}

function startProcess(name, command, args, delay = 3000, envOverrides = {}) {
  console.log(`[start.js] Starting ${name}: ${command} ${args.join(' ')}`);

  const proc = spawn(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  proc.on('error', (err) => {
    console.error(`[start.js] ${name} error:`, err);
  });

  proc.on('exit', (code, signal) => {
    const nextDelay = Math.min(delay * 2, 60000); // max 60s
    console.error(`[start.js] ${name} exited with code=${code} signal=${signal}. Restarting in ${nextDelay / 1000}s...`);
    setTimeout(() => startProcess(name, command, args, nextDelay, envOverrides), nextDelay);
  });

  return proc;
}

// Start Express HTTP server
startProcess('Express Server', 'node', ['server.js'], 3000, {
  CARELY_DISABLE_AUTO_AGENT: '1',
  BEY_API_KEY: process.env.BEY_API_KEY || '',
});

// Start LiveKit Agent worker
// 'dev' arg connects in development mode — remove for production
startProcess('LiveKit Agent', 'node', ['agent.js', 'dev'], 3000, {
  BEY_API_KEY: process.env.BEY_API_KEY || '',
});
