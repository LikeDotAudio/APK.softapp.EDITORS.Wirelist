// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* ROAD-3598: the schedule table exports IFC beside CSV — each run shown an IfcCableSegment
   (wirelistRowIfc.js), written by THE ONE TABLE's writer (vendor/apk-table/apk-table.js rowsToIfc).
   WIRELIST_IFC_OUT=<dir> writes the file there, for IfcOpenShell. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WirelistModel } from '../js/wirelistModel.js';
import { wirelistRowIfc } from '../js/wirelistRowIfc.js';

// a plain script (window.APKTable); in this "type": "module" package it loads as one and sets globalThis.APKTable
await import('../vendor/apk-table/apk-table.js');
const T = globalThis.APKTable;

test('each run is one IfcCableSegment with its length (mm) and APK_Connection', () => {
  const model = new WirelistModel();
  const ifc = T.rowsToIfc(model.wires, wirelistRowIfc(model), { timestamp: '2026-11-06T12:00:00' });
  assert.equal((ifc.match(/=IFCCABLESEGMENT\(/g) || []).length, model.wires.length);
  assert.match(ifc, /IFCCABLESEGMENT\('[0-9A-Za-z_$]{22}',\$,'W-001','DSP-01 \/ OUT-1 \\X2\\2192\\X0\\ AMP-01 \/ IN-1','Belden 1800F \(AES\/EBU\)',\$,\$,'W-001',\.CABLESEGMENT\.\)/);
  assert.match(ifc, /IFCQUANTITYLENGTH\('Length',\$,\$,13716\.,\$\)/); // 45 ft
  assert.match(ifc, /'CableColour',\$,IFCLABEL\('Purple'\)/);
  if (process.env.WIRELIST_IFC_OUT) {
    mkdirSync(process.env.WIRELIST_IFC_OUT, { recursive: true });
    writeFileSync(join(process.env.WIRELIST_IFC_OUT, 'facility_wirelist.ifc'), ifc);
  }
});
