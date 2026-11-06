// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* ROAD-3582 step 1: the wirelist's .ifc twin. js/wirelistToIfc.js writes the runs as IFC4X3_ADD2 (each
   run an IfcCableSegment with two end ports, each end ONE IfcRelConnectsPorts), js/wirelistIfc.js reads
   them back to the same runs, and the same runs write the same bytes. Held to the demo schedule, to every
   run of the seed bench (tests/fixtures/seed-bench.ifc.gz, what DATABASE.server.BIM serves), and to the
   shared Save Model. IfcOpenShell checks the files too: tests/fixtures/validate_twin.py. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

import { WirelistModel } from '../js/wirelistModel.js';
import { wirelistToIfc, endOf, isBareLink, lengthMmOf, systemTypeOf, MM_PER_FT } from '../js/wirelistToIfc.js';
import { wirelistFromIfc, schemaOf } from '../js/wirelistIfc.js';
import * as ifc from '../js/ifc/step.mjs';
import { ifcGuid, IFC_GUID_RE } from '../js/ifc/guid.mjs';
import { available, renderGuid, GUID_OUT } from './fixtures/make_step_codec.mjs';
import { world } from './softapp-harness.mjs';

const BENCH = zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/seed-bench.ifc.gz', import.meta.url))).toString('utf8');
const ROW_KEYS = ['id', 'connection', 'cable', 'type', 'lengthMm', 'lenFt', 'from', 'to', 'fromDevice', 'fromPort', 'fromConnector',
  'toDevice', 'toPort', 'toConnector', 'system', 'systemType', 'signal', 'color', 'status', 'kind', 'medium', 'fromMac', 'fromSerial'];

/** Each run's own fields, as the twin read back gives them. */
const sameRuns = (want, got, keys) => {
  assert.equal(got.length, want.length, 'one run back per run');
  want.forEach((w, i) => {
    for (const k of keys(w)) assert.deepEqual(got[i][k], w[k], `run ${i} (${w.id}) ${k}`);
  });
};

function demo() {
  const m = new WirelistModel();
  const t = m.addFromThing({ mac: 'b8:27:eb:00:00:01', serial: 'SN-123', name: 'Stagebox', ips: ['10.1.1.1'] });
  Object.assign(t, { to: 'DSP-01 / OUT-1', lenFt: 12.25, type: 'Cat6A STP', signal: 'Network', color: 'Blue' });
  m.addWire({ id: 'W-010', type: 'Mogami 2534', lenFt: 0, from: 'DESK / OUT L', to: 'AMP-01 / IN-1', signal: '', color: '' });
  return m;
}

test('the twin is IFC4X3_ADD2: one IfcCableSegment per run, two ports each, one IfcRelConnectsPorts per mated end', () => {
  const m = demo();
  const text = wirelistToIfc(m.toBlock());
  assert.equal(schemaOf(text), 'IFC4X3_ADD2');
  const f = ifc.parseStep(text);
  const cables = ifc.entitiesByType(f, 'IFCCABLESEGMENT');
  assert.equal(cables.length, m.wires.length);
  for (const c of cables) assert.deepEqual(ifc.ports(f, c).map((p) => p.args[2]), ['A', 'B'], 'end ports nested A then B');
  assert.equal(ifc.connections(f).length, 2 * m.wires.length, 'every run has both ends, one relationship each');
  assert.ok(ifc.connections(f).every((c) => !c.realizing), 'IFC4: the cable is in the path, not a RealizingElement');
  const gids = f.entities.filter((e) => typeof e.args[0] === 'string' && IFC_GUID_RE.test(e.args[0])).map((e) => e.args[0]);
  assert.equal(new Set(gids).size, gids.length, 'GlobalIds are unique');
  assert.equal(ifc.entitiesByType(f, 'IFCPROJECT')[0].args[0], ifcGuid('wirelist', 'wirelist'));
});

test('the demo schedule round-trips: every field of every run comes back, and the same runs write the same bytes', () => {
  const m = demo();
  const text = wirelistToIfc(m.toBlock());
  const back = wirelistFromIfc(text);
  sameRuns(m.wires, back, (w) => Object.keys(w));
  assert.equal(wirelistToIfc(back), text, 'what was read writes the same file');
  assert.equal(wirelistToIfc(demo().toBlock()), text, 'two saves are byte-identical');
  assert.equal(back[7].lengthMm, 12.25 * MM_PER_FT, 'lengths are mm in the file, feet only for display');
  assert.equal(back[8].lengthMm, null, '0 ft is not a length: no quantity is written');
});

test('the device a run starts at keeps its MAC and serial — never its IP — and a reused port fans out', () => {
  const m = demo();
  const text = wirelistToIfc(m.toBlock());
  assert.ok(!text.includes('10.1.1.1'));
  const f = ifc.parseStep(text);
  const stagebox = ifc.entitiesByType(f, 'IFCDISTRIBUTIONELEMENT').find((e) => e.args[7] === 'Stagebox');
  assert.equal(stagebox.args[0], ifcGuid('inst', 'mac:b8:27:eb:00:00:01'), 'its GlobalId is its identity');
  const sets = ifc.getPsets(f, stagebox);
  assert.equal(sets.APK_Identity.MacAddress, 'b8:27:eb:00:00:01');
  assert.equal(sets.Pset_ManufacturerOccurrence.SerialNumber, 'SN-123');
  // DSP-01 / OUT-1 is W-001's A end and the Stagebox run's B end: two ports, the second folding back
  const dsp = ifc.entitiesByType(f, 'IFCDISTRIBUTIONELEMENT').find((e) => e.args[7] === 'DSP-01');
  const fan = ifc.ports(f, dsp).find((p) => String(p.args[2]).startsWith('OUT-1 / '));
  assert.equal(ifc.getPsets(f, fan).APK_Terminal.FansOutOf, 'port:OUT-1');
  assert.equal(wirelistFromIfc(text)[7].to, 'DSP-01 / OUT-1');
});

test('every run of the seed bench survives bench.ifc → wirelist → twin → wirelist, bare links staying bare', () => {
  const rows = wirelistFromIfc(BENCH);
  assert.ok(rows.length > 100);
  const text = wirelistToIfc(rows, { name: 'bench' });
  const back = wirelistFromIfc(text);
  sameRuns(rows, back, () => ROW_KEYS);
  assert.equal(wirelistToIfc(back, { name: 'bench' }), text);
  const f = ifc.parseStep(text);
  const cabled = rows.filter((r) => !isBareLink(r));
  assert.equal(ifc.entitiesByType(f, 'IFCCABLESEGMENT').length, cabled.length, 'only a run with a cable is a cable');
  assert.ok(cabled.length >= 2 && cabled.length < rows.length);
});

test('the pieces: an end splits at its first " / ", a length is mm or feet × 304.8, a signal names a system type', () => {
  assert.deepEqual(endOf({ from: 'A / B / C' }, 'from'), { device: 'A', port: 'B / C' });
  assert.deepEqual(endOf({ from: 'CORE-SW01' }, 'from'), { device: 'CORE-SW01', port: '' });
  assert.deepEqual(endOf({ from: 'x / y', fromDevice: 'U1', fromPort: 'I1' }, 'from'), { device: 'U1', port: 'I1' });
  assert.equal(lengthMmOf({ lenFt: 10 }), 3048);
  assert.equal(lengthMmOf({ lenFt: 10, lengthMm: 2500 }), 2500);
  assert.equal(lengthMmOf({ lenFt: 0 }), null);
  assert.deepEqual(['Network', 'Digital Audio', '12G Video', 'RS-232', 'Mains', '', 'Word clock'].map(systemTypeOf),
    ['DATA', 'AUDIOVISUAL', 'AUDIOVISUAL', 'CONTROL', 'ELECTRICAL', 'NOTDEFINED', 'SIGNAL']);
});

test('standalone Save Model writes wirelist.ifc and wirelist.json, both, from the shared client', async () => {
  const w = world({ framed: false });
  const m = demo();
  const block = m.toBlock();
  const r = await w.S.saveModel(block, { name: 'wirelist', toIfc: (b) => wirelistToIfc(b, { name: 'wirelist' }) });
  assert.equal(r.ok, true);
  assert.deepEqual(w.downloads.map((d) => d.name), ['wirelist.ifc', 'wirelist.json']);
  assert.equal(w.downloads[0].text, wirelistToIfc(block));
  assert.deepEqual(JSON.parse(w.downloads[1].text).wires, block.wires);
});

test('js/ifc/guid.mjs is the contracts GlobalId rule, current', (t) => {
  if (!available()) return t.skip('contracts/src/ifc/guid.ts or contracts/node_modules is not beside this app');
  assert.equal(fs.readFileSync(GUID_OUT, 'utf8'), renderGuid(), 'stale: node tests/fixtures/make_step_codec.mjs');
});
