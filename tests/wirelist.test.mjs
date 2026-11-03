import test from 'node:test';
import assert from 'node:assert/strict';
import { WirelistModel } from '../js/wirelistApp.js';

test('WirelistModel calculates total pull lengths and manages cable entries', () => {
  const wl = new WirelistModel();
  assert.equal(wl.wires.length, 4);
  assert.equal(wl.getTotalLength(), 45 + 45 + 75 + 110);

  wl.addWire({ id: 'W-005', type: 'Speaker 12AWG', lenFt: 50, from: 'AMP:1', to: 'SPK:1', status: 'Planned' });
  assert.equal(wl.wires.length, 5);
  assert.equal(wl.getTotalLength(), 325);
});
