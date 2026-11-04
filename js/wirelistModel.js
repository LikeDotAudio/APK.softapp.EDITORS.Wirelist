// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

export class WirelistModel {
  constructor() {
    this.wires = [
      { id: 'W-001', type: 'Belden 1800F (AES/EBU)', lenFt: 45, from: 'DSP-01 / OUT-1', to: 'AMP-01 / IN-1', status: 'Terminated', signal: 'Digital Audio', color: 'Purple' },
      { id: 'W-002', type: 'Belden 1800F (AES/EBU)', lenFt: 45, from: 'DSP-01 / OUT-2', to: 'AMP-01 / IN-2', status: 'Terminated', signal: 'Digital Audio', color: 'Purple' },
      { id: 'W-003', type: 'Cat6A STP (Dante Primary)', lenFt: 60, from: 'CORE-SW01 / P-01', to: 'DSP-01 / LAN-A', status: 'Verified', signal: 'Network', color: 'Blue' },
      { id: 'W-004', type: 'Cat6A STP (Dante Sec)', lenFt: 60, from: 'CORE-SW01 / P-02', to: 'DSP-01 / LAN-B', status: 'Verified', signal: 'Network', color: 'Red' },
      { id: 'W-005', type: 'Canare L-4E6S StarQuad', lenFt: 25, from: 'MIC-PANEL-A / CH-1', to: 'STAGEBOX / IN-1', status: 'Pulled', signal: 'Mic Audio', color: 'Black' },
      { id: 'W-006', type: 'Canare L-4E6S StarQuad', lenFt: 25, from: 'MIC-PANEL-A / CH-2', to: 'STAGEBOX / IN-2', status: 'Pulled', signal: 'Mic Audio', color: 'Black' },
      { id: 'W-007', type: 'Canare 12G-SDI Coax', lenFt: 85, from: 'CAM-PTZ-01 / SDI', to: 'VIDEO-ROUTER / IN-1', status: 'Terminated', signal: '12G Video', color: 'Green' },
    ];
  }

  getTotalLength() {
    return this.wires.reduce((acc, w) => acc + (w.lenFt || 0), 0);
  }
}
