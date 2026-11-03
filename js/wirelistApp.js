// Part of the APK.audio project — Anthony Kuzub
// MIT Licence.

export class WirelistModel {
  constructor() {
    this.wires = [
      { id: 'W-001', type: 'Belden 1800F', lenFt: 45, from: 'STAGEBOX-A:1', to: 'CONSOLE:CH1', status: 'Terminated' },
      { id: 'W-002', type: 'Belden 1800F', lenFt: 45, from: 'STAGEBOX-A:2', to: 'CONSOLE:CH2', status: 'Terminated' },
      { id: 'W-003', type: 'Belden 1694A', lenFt: 75, from: 'CAMERA-01:SDI', to: 'ROUTER:IN1', status: 'Pulled' },
      { id: 'W-004', type: 'Cat6A Shielded', lenFt: 110, from: 'DSP-01:PRI', to: 'CORE-SW:P1', status: 'Terminated' }
    ];
  }

  addWire(wire) {
    this.wires.push(wire);
  }

  getTotalLength() {
    return this.wires.reduce((sum, w) => sum + (w.lenFt || 0), 0);
  }
}
