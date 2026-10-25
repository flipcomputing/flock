#!/usr/bin/env node
// Serves the dev server to an Android phone as http://localhost:<port>. WebXR
// needs a secure context and a plain LAN IP is not one, so `adb reverse` tunnels
// the port to make the phone's origin localhost. USB or Wi-Fi debugging both work.

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';

const [command, ...rest] = process.argv.slice(2);
const isSubcommand = command === 'pair' || command === 'connect';
const PORT = (isSubcommand ? rest[1] : command) || '5173';

const candidates = [
  'adb',
  `${homedir()}/Android/Sdk/platform-tools/adb`,
  ...['/mnt/c/Users', '/mnt/c'].flatMap((root) => [
    `${root}/${process.env.USER}/AppData/Local/Android/Sdk/platform-tools/adb.exe`,
    `${root}/platform-tools/adb.exe`,
  ]),
];

const adb = candidates.find((path) => {
  if (path !== 'adb' && !existsSync(path)) return false;
  try {
    execFileSync(path, ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    // Not on PATH, or not runnable from here -- try the next candidate.
    return false;
  }
});

if (!adb) {
  console.error('adb not found. Install Android platform-tools, or pass its path on PATH.');
  process.exit(1);
}

const run = (...args) => execFileSync(adb, args, { encoding: 'utf8' });

if (isSubcommand) {
  const target = rest[0];
  if (!target) {
    console.error(`Usage: npm run dev:phone -- ${command} <ip>:<port>`);
    process.exit(1);
  }
  // adb pair prompts for the code on stdin.
  execFileSync(adb, [command, target], { stdio: 'inherit' });
  if (command === 'pair') {
    console.log('\nNow: npm run dev:phone -- connect <ip>:<debug-port>');
    process.exit(0);
  }
  // A connected device with no tunnel still cannot load the page, so connect sets it up too.
}

const devices = run('devices')
  .split('\n')
  .slice(1)
  .map((line) => line.trim())
  .filter(Boolean);

const ready = devices.filter((line) => line.endsWith('\tdevice'));

if (!ready.length) {
  console.error('No authorised device.\n');
  console.error(devices.length ? `adb sees:\n  ${devices.join('\n  ')}\n` : '');
  console.error('USB:      enable Developer options > USB debugging, plug in, accept the prompt.');
  console.error(
    'Wi-Fi:    Developer options > Wireless debugging > Pair device with pairing code,'
  );
  console.error('          then: npm run dev:phone -- pair <ip>:<pair-port>');
  console.error('          then: npm run dev:phone -- connect <ip>:<debug-port>');
  process.exit(1);
}

run('reverse', `tcp:${PORT}`, `tcp:${PORT}`);

console.log(`Reversed on ${ready.length} device(s):\n  ${ready.join('\n  ')}\n`);
console.log(`On the phone open:  http://localhost:${PORT}`);
console.log('DevTools:           chrome://inspect/#devices in desktop Chrome');
