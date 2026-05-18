import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register a no-op async loader hook (any async module.register caller
// triggers the bug — Sentry, OpenTelemetry, datadog-trace, etc. all do
// this transitively via import-in-the-middle).
register(pathToFileURL('./hook.mjs').href);

// Dynamically import a sibling .ts file.
const m = await import('./child.ts');

console.log('keys:    ', Object.keys(m));
console.log('m.value: ', m.value);
