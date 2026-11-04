// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { WirelistModel } from '../js/wirelistModel.js';

test('Wirelist Model Initialization and Total Length', () => {
  const model = new WirelistModel();
  assert.ok(model.wires.length >= 5);
  const total = model.getTotalLength();
  assert.ok(total > 0);
  assert.equal(typeof total, 'number');
});
