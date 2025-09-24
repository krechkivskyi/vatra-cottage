import { tests as mergeTests } from './merge.test.mjs';
import { tests as filterTests } from './filter.test.mjs';

const allTests = [...mergeTests, ...filterTests];

let failures = 0;

for (const { name, fn } of allTests) {
  try {
    await fn();
    console.log(`\u2714 ${name}`);
  } catch (error) {
    failures += 1;
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(`\u274c ${name}`);
    console.error(message);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
