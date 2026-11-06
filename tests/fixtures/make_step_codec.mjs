// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* js/ifc/step.mjs is the contracts STEP codec (contracts/src/ifc/step.ts) and js/ifc/guid.mjs the
   contracts GlobalId rule (contracts/src/ifc/guid.ts), each as plain JS: the page loads them with no
   build. This makes both, and --check says whether they are current (tests/wirelistIfc.test.mjs and
   tests/wirelistToIfc.test.mjs run the check whenever the contracts checkout and its esbuild sit
   beside this app).

     node tests/fixtures/make_step_codec.mjs [--check]     (from the monorepo checkout) */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const HERE = new URL('../../', import.meta.url);
export const OUT = new URL('js/ifc/step.mjs', HERE);
export const GUID_OUT = new URL('js/ifc/guid.mjs', HERE);
export const MONO = new URL('../../../../../', HERE);
export const STEP_TS = new URL('contracts/src/ifc/step.ts', MONO);
export const GUID_TS = new URL('contracts/src/ifc/guid.ts', MONO);
const ESBUILD = new URL('contracts/node_modules/esbuild/package.json', MONO);

const banner = (what, src, out) => `// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// GENERATED — do not edit. ${what}, contracts/src/ifc/${src},
// as plain ES module JS for a page with no build. Regenerate: node tests/fixtures/make_step_codec.mjs
`;
export const BANNER = banner('The contracts STEP codec (ISO 10303-21 reader/writer)', 'step.ts');

/** [out URL, source URL, banner] for each generated file. */
export const FILES = [
  [OUT, STEP_TS, BANNER],
  [GUID_OUT, GUID_TS, banner('The contracts GlobalId rule (uuid5 → 22-character IFC GlobalId)', 'guid.ts')],
];

export function available() { return fs.existsSync(STEP_TS) && fs.existsSync(GUID_TS) && fs.existsSync(ESBUILD); }

function transform(src, head) {
  const esbuild = createRequire(ESBUILD)('esbuild');
  const { code } = esbuild.transformSync(fs.readFileSync(src, 'utf8'), { loader: 'ts', format: 'esm', target: 'es2020' });
  return head + code;
}

/** js/ifc/step.mjs as it should be. */
export function render() { return transform(STEP_TS, BANNER); }

/** js/ifc/guid.mjs as it should be. */
export function renderGuid() { return transform(GUID_TS, FILES[1][2]); }

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!available()) { console.error('needs contracts/src/ifc/{step,guid}.ts and contracts/node_modules (cd contracts && npm ci)'); process.exit(2); }
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [out, src, head] of FILES) {
    const want = transform(src, head);
    const name = out.pathname.split('/').slice(-3).join('/');
    if (check) {
      const ok = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === want;
      console.log(ok ? `${name} is current` : `${name} is STALE: node tests/fixtures/make_step_codec.mjs`);
      if (!ok) stale++;
    } else {
      fs.writeFileSync(out, want);
      console.log(`wrote ${name} (${want.length} bytes) from contracts/src/ifc/${src.pathname.split('/').pop()}`);
    }
  }
  process.exit(stale ? 1 : 0);
}
