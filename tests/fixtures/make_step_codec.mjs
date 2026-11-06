// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* js/ifc/step.mjs is the contracts STEP codec (contracts/src/ifc/step.ts) as plain JS: the page loads
   it with no build. This makes it, and --check says whether it is current (tests/wirelistIfc.test.mjs
   runs the check whenever the contracts checkout and its esbuild sit beside this app).

     node tests/fixtures/make_step_codec.mjs [--check]     (from the monorepo checkout) */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const HERE = new URL('../../', import.meta.url);
export const OUT = new URL('js/ifc/step.mjs', HERE);
export const MONO = new URL('../../../../../', HERE);
export const STEP_TS = new URL('contracts/src/ifc/step.ts', MONO);
const ESBUILD = new URL('contracts/node_modules/esbuild/package.json', MONO);

export const BANNER = `// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// GENERATED — do not edit. The contracts STEP codec (ISO 10303-21 reader/writer), contracts/src/ifc/step.ts,
// as plain ES module JS for a page with no build. Regenerate: node tests/fixtures/make_step_codec.mjs
`;

export function available() { return fs.existsSync(STEP_TS) && fs.existsSync(ESBUILD); }

export function render() {
  const esbuild = createRequire(ESBUILD)('esbuild');
  const { code } = esbuild.transformSync(fs.readFileSync(STEP_TS, 'utf8'), { loader: 'ts', format: 'esm', target: 'es2020' });
  return BANNER + code;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!available()) { console.error('needs contracts/src/ifc/step.ts and contracts/node_modules (cd contracts && npm ci)'); process.exit(2); }
  const want = render();
  if (process.argv.includes('--check')) {
    const ok = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === want;
    console.log(ok ? 'js/ifc/step.mjs is current' : 'js/ifc/step.mjs is STALE: node tests/fixtures/make_step_codec.mjs');
    process.exit(ok ? 0 : 1);
  }
  fs.writeFileSync(OUT, want);
  console.log(`wrote js/ifc/step.mjs (${want.length} bytes) from contracts/src/ifc/step.ts`);
}
