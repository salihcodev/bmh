#!/usr/bin/env node
// Prints a JDK 21+ home for the Firebase emulators. firebase-tools runs `java` from PATH
// and rejects anything older than 21, while this machine's default JAVA_HOME is often 17.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const candidates = [
  process.env.JAVA_HOME,
  '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
].filter(Boolean);

function major(home) {
  const java = `${home}/bin/java`;
  if (!existsSync(java)) return 0;
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const match = /version "(\d+)/.exec(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  return match ? Number(match[1]) : 0;
}

for (const home of candidates) {
  if (major(home) >= 21) {
    console.log(home);
    process.exit(0);
  }
}

console.error('Firebase emulators need JDK 21 or newer. Install it with: brew install openjdk@21');
process.exit(1);
