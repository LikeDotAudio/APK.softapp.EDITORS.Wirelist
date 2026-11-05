// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

export const WIRELIST_BLOCK_TYPE = 'wirelist';
export const WIRE_STATUSES = ['Unpulled', 'Pulled', 'Terminated', 'Verified'];
export const FT_TO_M = 0.3048;   // exact, by definition of the international foot (1959)

const num = (v, dflt) => (v !== '' && v !== null && Number.isFinite(Number(v)) ? Number(v) : dflt);

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
    return this.wires.reduce((acc, w) => acc + num(w.lenFt, 0), 0);
  }

  nextId() {
    let n = this.wires.length + 1;
    const taken = new Set(this.wires.map((w) => w.id));
    while (taken.has(`W-${String(n).padStart(3, '0')}`)) n++;
    return `W-${String(n).padStart(3, '0')}`;
  }

  addWire(w = {}) {
    const wire = {
      id: w.id || this.nextId(),
      type: w.type ?? 'Cat6A STP',
      lenFt: num(w.lenFt, 0),
      from: w.from ?? '',
      to: w.to ?? '',
      status: w.status || 'Unpulled',
      signal: w.signal ?? '',
      color: w.color ?? '',
    };
    for (const k of ['fromMac', 'fromSerial']) if (w[k]) wire[k] = String(w[k]);
    this.wires.push(wire);
    return wire;
  }

  removeWire(index) {
    return index >= 0 && index < this.wires.length ? this.wires.splice(index, 1)[0] : null;
  }

  updateWire(index, field, value) {
    const w = this.wires[index];
    if (!w) return;
    w[field] = field === 'lenFt' ? Math.max(0, num(value, 0)) : value;
  }

  /** A new run starting at a discovered thing; the far end is left for the user. Keyed by MAC / serial, never IP. */
  addFromThing(t = {}) {
    return this.addWire({
      from: t.name || t.model || t.mac || t.serial || '',
      to: '',
      lenFt: 0,
      fromMac: t.mac || '',
      fromSerial: t.serial || '',
    });
  }

  toBlock() {
    const wires = JSON.parse(JSON.stringify(this.wires));
    const totalLengthFt = this.getTotalLength();
    return {
      type: WIRELIST_BLOCK_TYPE,
      wires,
      totalLengthFt,
      totalLengthM: Math.round(totalLengthFt * FT_TO_M * 1000) / 1000,
      totalCables: wires.length,
    };
  }

  fromBlock(block) {
    if (!block) return false;
    const raw = Array.isArray(block) ? block : block.wires;
    if (!Array.isArray(raw)) return false;
    this.wires = JSON.parse(JSON.stringify(raw));
    return true;
  }
}
