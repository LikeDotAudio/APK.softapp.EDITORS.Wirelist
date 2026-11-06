// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* cabling-4: the wirelist as a query over IfcRelConnectsPorts, held to an .ifc DATABASE.server.BIM
   really serves (tests/fixtures/seed-bench.ifc.gz — the seed bench with two cables patched in through
   Bench.put_connection, made by tests/fixtures/make_bench_fixture.py) and to an expectation made
   WITHOUT this codec (the bench JSON, plus IfcOpenShell for connectors and systems). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

import { wirelistFromIfc, schemaOf } from '../js/wirelistIfc.js';
import { WirelistModel, WIRELIST_COLUMNS } from '../js/wirelistModel.js';
import * as ifc from '../js/ifc/step.mjs';
import { available, render, OUT } from './fixtures/make_step_codec.mjs';

const FIX = new URL('./fixtures/', import.meta.url);
const TEXT = zlib.gunzipSync(fs.readFileSync(new URL('seed-bench.ifc.gz', FIX))).toString('utf8');
const EXPECTED = JSON.parse(fs.readFileSync(new URL('seed-bench.expected.json', FIX), 'utf8'));
const ROWS = wirelistFromIfc(TEXT);
const byConn = new Map(ROWS.map((r) => [r.connection, r]));

test('the fixture is an IFC4X3_ADD2 bench model with its connections and two real cables', () => {
  assert.equal(schemaOf(TEXT), 'IFC4X3_ADD2');
  const f = ifc.parseStep(TEXT);
  assert.equal(ifc.entitiesByType(f, 'IFCCABLESEGMENT').length, 2);
  assert.ok(ifc.connections(f).length >= EXPECTED.rows.length);
});

test('one wirelist row per bench connection — a cable is one row, never one per IfcRelConnectsPorts', () => {
  assert.equal(ROWS.length, EXPECTED.rows.length);
  assert.deepEqual([...byConn.keys()].sort(), EXPECTED.rows.map((r) => r.connection).sort());
});

test('each row: cable tag, A end device / port, B end device / port, signal, medium, kind — as the bench JSON says', () => {
  for (const want of EXPECTED.rows) {
    const got = byConn.get(want.connection);
    assert.ok(got, want.connection);
    assert.deepEqual(
      [got.cable, got.fromDevice, got.fromPort, got.toDevice, got.toPort, got.signal, got.medium, got.kind],
      [want.cable, want.a.device, want.a.port, want.b.device, want.b.port, want.signal, want.medium, want.kind],
      want.connection,
    );
    assert.equal(got.from, `${want.a.device} / ${want.a.port}`);
    assert.equal(got.to, `${want.b.device} / ${want.b.port}`);
  }
});

test('connectors and systems agree with IfcOpenShell reading the same file', (t) => {
  if (!EXPECTED.ifcopenshell) return t.skip('the fixture was made without IfcOpenShell');
  for (const want of EXPECTED.rows) {
    const got = byConn.get(want.connection);
    assert.deepEqual([got.fromConnector, got.toConnector, got.system], [want.a.connector, want.b.connector, want.system], want.connection);
  }
  assert.ok(ROWS.some((r) => r.fromConnector), 'at least one end names its connector');
  assert.ok(new Set(ROWS.map((r) => r.system)).size >= 2, 'more than one system');
});

test('a cable row carries its length in mm, colour, status and part; the length column is derived, not typed', () => {
  for (const want of EXPECTED.rows.filter((r) => r.cabled)) {
    const got = byConn.get(want.connection);
    assert.equal(got.id, want.cable, 'the wire # is the cable tag');
    assert.equal(got.lengthMm, want.lengthMm);
    assert.equal(got.lenFt, Math.round((want.lengthMm / 304.8) * 10) / 10);
    assert.equal(got.color, want.color);
    assert.equal(got.status, want.status);
    if (want.cablePart) assert.notEqual(got.type, 'Cable', 'a typed cable names its type');
    else assert.equal(got.type, 'Cable', 'an untyped cable is a Cable, not its connection id');
  }
  const bare = ROWS.find((r) => !r.cable);
  assert.equal(bare.lengthMm, null);
  assert.equal(bare.id, bare.connection, 'a bare link is listed by its connection id');
});

test('a fan-out port answers for its terminal: no row names a "<terminal> / <id>" port', () => {
  assert.ok(!ROWS.some((r) => r.fromPort.includes(` / ${r.connection}`) || r.toPort.includes(` / ${r.connection}`)));
  const fabric = ROWS.filter((r) => r.toDevice === 'U106' && r.toPort === 'fabric');
  assert.ok(fabric.length > 50, 'the switch fabric ends many links');
});

test('no IP is ever a device: devices are bench refs (Tag)', () => {
  const ip = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;
  assert.ok(ROWS.every((r) => !ip.test(r.fromDevice) && !ip.test(r.toDevice)));
});

test('the rows load into the model and keep its CSV columns (cable, both ends, connectors, system)', () => {
  const m = new WirelistModel();
  assert.ok(m.fromBlock({ wires: ROWS }));
  const block = m.toBlock();
  assert.equal(block.totalCables, ROWS.length);
  const keys = WIRELIST_COLUMNS.map((c) => c.key);
  for (const k of ['id', 'type', 'lenFt', 'lengthMm', 'from', 'fromConnector', 'to', 'toConnector', 'system', 'signal', 'color', 'status']) {
    assert.ok(keys.includes(k), k);
  }
});

test('a foreign shape: RealizingElement cable (IFC2X3 style), IfcRelConnectsPortToElement, metre units', () => {
  const step = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('x.ifc','',(''),(''),'','','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#10=IFCFLOWTERMINAL('a',$,'Desk',$,$,$,$,'D1');
#11=IFCFLOWTERMINAL('b',$,'Amp',$,$,$,$,'A1');
#12=IFCDISTRIBUTIONPORT('p1',$,'OUT L',$,$,$,$,.SOURCE.);
#13=IFCDISTRIBUTIONPORT('p2',$,'IN 1',$,$,$,$,.SINK.);
#14=IFCRELCONNECTSPORTTOELEMENT('r1',$,$,$,#12,#10);
#15=IFCRELCONNECTSPORTTOELEMENT('r2',$,$,$,#13,#11);
#20=IFCCABLESEGMENT('c',$,'Run 7',$,$,$,$,'C-7');
#21=IFCPROPERTYSINGLEVALUE('Length',$,IFCLENGTHMEASURE(2.5),$);
#22=IFCQUANTITYLENGTH('Length',$,$,2.5);
#23=IFCELEMENTQUANTITY('q',$,'Qto_CableSegmentBaseQuantities',$,$,(#22));
#24=IFCRELDEFINESBYPROPERTIES('d',$,$,$,(#20),#23);
#30=IFCRELCONNECTSPORTS('k',$,'K1',$,#12,#13,#20);
ENDSEC;
END-ISO-10303-21;
`;
  const [r] = wirelistFromIfc(step);
  assert.deepEqual([r.id, r.cable, r.from, r.to, r.lengthMm, r.connection], ['C-7', 'C-7', 'D1 / OUT L', 'A1 / IN 1', 2500, 'K1']);
});

test('a malformed file throws the codec error (the page shows it as bad_input)', () => {
  assert.throws(() => wirelistFromIfc('ISO-10303-21;\nDATA;\n#1=IFCX(;\n'), /line|STEP|expected/i);
});

test('js/ifc/step.mjs is the contracts codec, current', (t) => {
  if (!available()) return t.skip('contracts/src/ifc/step.ts or contracts/node_modules is not beside this app');
  assert.equal(fs.readFileSync(OUT, 'utf8'), render(), 'stale: node tests/fixtures/make_step_codec.mjs');
});
