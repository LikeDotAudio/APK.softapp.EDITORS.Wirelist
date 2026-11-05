// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* ROAD-3489: the Wirelist block round trip over cad.like.audio/host@1, through the
   vendored apk-softapp.js the page loads — and a run started at a discovered thing. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { WirelistModel, WIRELIST_BLOCK_TYPE } from '../js/wirelistModel.js';
import { thingRow } from '../js/discoveredPanel.js';
import { world, roundTrip, ORIGIN, PROTOCOL } from './softapp-harness.mjs';

const connect = (model) => (S) => S.connectHost({
  editor: 'Wirelist Editor', blockType: WIRELIST_BLOCK_TYPE,
  onLoad: (b) => model.fromBlock(b), onRequest: () => model.toBlock(),
});

test('Wirelist: the CAD loads a block, asks for it back, gets the same runs at its own origin', () => {
  const model = new WirelistModel();
  const block = { type: WIRELIST_BLOCK_TYPE, wires: [
    { id: 'W-100', type: 'Cat6A', lenFt: 10, from: 'A', to: 'B', status: 'Pulled', signal: 'Network', color: 'Blue' },
    { id: 'W-101', type: 'Coax', lenFt: 100, from: 'C', to: 'D', status: 'Verified', signal: 'SDI', color: 'Green' },
  ] };
  const { w, ready, saved } = roundTrip({ connect: connect(model), block });
  assert.equal(ready.m.protocol, PROTOCOL);
  assert.equal(model.wires.length, 2);
  assert.equal(saved.o, ORIGIN);
  assert.deepEqual(saved.m.block.wires, block.wires);
  assert.equal(saved.m.block.totalLengthFt, 110);
  assert.equal(saved.m.block.totalLengthM, 33.528);
  assert.ok(w.toParent.every((x) => x.o === ORIGIN && x.m.protocol === PROTOCOL));
  assert.equal(w.downloads.length, 0, 'no download when embedded');
});

test('Wirelist: a load from a window that is not the parent is ignored', () => {
  const model = new WirelistModel();
  const w = world();
  connect(model)(w.S);
  w.fire({ protocol: PROTOCOL, type: 'load', block: { wires: [] } }, { source: {} });
  assert.ok(model.wires.length > 0);
});

test('Wirelist: a run from a discovered thing carries its MAC, not its IP', () => {
  const model = new WirelistModel();
  const t = { id: 's', mac: 'b8:27:eb:00:00:01', name: 'Stagebox', ips: ['10.1.1.1'], protocols: ['nmos'], live: { state: 'kinda', why: 'last verified 7 min ago' } };
  const wire = model.addFromThing(t);
  assert.equal(wire.from, 'Stagebox');
  assert.equal(wire.fromMac, t.mac);
  assert.ok(!JSON.stringify(wire).includes('10.1.1.1'));
  assert.notEqual(wire.id, model.wires[0].id);
  assert.equal(thingRow(t).state, 'kinda');
});
