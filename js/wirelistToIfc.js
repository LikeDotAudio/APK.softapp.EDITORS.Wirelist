// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* wirelistToIfc.js — THE WIRELIST'S .IFC TWIN (ROAD-3582 step 1, IFC-CORE-DELTAS cabling-4). Save writes
   the native block (wirelistModel.js toBlock) AND this IFC4X3_ADD2 file; js/wirelistIfc.js reads it back
   to the same runs. Written with the contracts STEP writer (js/ifc/step.mjs) and GlobalId rule
   (js/ifc/guid.mjs), no IfcOpenShell in the page. Byte-deterministic: the same runs write the same file.

     IfcProject ─ IfcSite ─ IfcBuilding ─ IfcBuildingStorey 'Cable schedule'   units: mm
     a run (a wire)   IfcCableSegment, Tag = the wire #, typed by one IfcCableSegmentType per cable type
                      (Name = 'Belden 1800F (AES/EBU)' …), Qto_CableSegmentBaseQuantities.Length in mm,
                      two end ports nested in order (A, then B), each joined by ONE IfcRelConnectsPorts
                      to a device port: device(SOURCE) → A, B → device(SINK). APK_Connection on the cable:
                      CableStatus (Unpulled / Pulled / Terminated / Verified), CableColour, Domain (the
                      signal), ConnectionId / Kind / Medium when the run came from the bench
     a bare link      a run read from a bench that has no cable (assumed, wireless): one IfcRelConnectsPorts
                      device port → device port, APK_Connection on the A-end port — never a made-up cable
     an end           'DEV / PORT' (or fromDevice / fromPort): an IfcDistributionElement Tag = DEV with an
                      IfcDistributionPort Name = PORT nested on it (IfcRelNests); APK_Terminal.Connector.
                      A port ends one connection (IFC: relating or related once), so a second run at the
                      same port gets its own port '<PORT> / <wire #>' with APK_Terminal.FansOutOf, which the
                      reader folds back. The device a run starts at keeps its identity, never an IP:
                      APK_Identity.MacAddress (GlobalId inst/mac:<mac>), Pset_ManufacturerOccurrence.SerialNumber
     the signal       one IfcDistributionSystem per system (the run's system, else its signal), the cables
                      (and a bare link's devices) grouped in it by IfcRelAssignsToGroup
   Everything the twin holds is ISO 16739 or an APK_ set declared in DATABASE.server.BIM
   SRC/tools/ifc/apk_psets.py; the totals in the block are derived and are not written. */

import { enumv, real, ref, typed, writeStep } from './ifc/step.mjs';
import { ifcGuid } from './ifc/guid.mjs';

export const WIRELIST_IFC_SCHEMA = 'IFC4X3_ADD2';
export const MM_PER_FT = 304.8;   // exact (the international foot, 1959)

const SYSTEM_TYPES = new Set(['AUDIOVISUAL', 'COMMUNICATION', 'CONTROL', 'DATA', 'EARTHING', 'ELECTRICAL',
  'ELECTROACOUSTIC', 'LIGHTING', 'SECURITY', 'SIGNAL', 'TELEPHONE', 'TV', 'USERDEFINED', 'NOTDEFINED']);

/** The IfcDistributionSystemEnum word a signal / system name reads as. */
export function systemTypeOf(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return 'NOTDEFINED';
  if (/earth|ground/.test(t)) return 'EARTHING';
  if (/power|mains|\bac\b|\bdc\b|\bpoe\b/.test(t)) return 'ELECTRICAL';
  if (/network|ethernet|\blan\b|dante|aes67|2110|\bip\b|\bdata\b|cat ?5|cat ?6|fib(er|re)/.test(t)) return 'DATA';
  if (/speaker|loudspeaker|\bpa\b/.test(t)) return 'ELECTROACOUSTIC';
  if (/video|sdi|hdmi|\b(3|6|12)g\b|dvi|displayport|audio|aes|mic|line|analog|madi|adat/.test(t)) return 'AUDIOVISUAL';
  if (/control|rs-?232|rs-?422|rs-?485|gpio|gpi|midi|serial|dmx/.test(t)) return 'CONTROL';
  return 'SIGNAL';
}

const str = (v) => (v == null ? '' : String(v));
const label = (s) => typed('IFCLABEL', String(s));
const ident = (s) => typed('IFCIDENTIFIER', String(s));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** 'DEV / PORT' → { device, port } (the first ' / ' splits; a run's own fromDevice / fromPort win). */
export function endOf(row, side) {
  const dev = row[`${side}Device`];
  const port = row[`${side}Port`];
  if (typeof dev === 'string' && dev) return { device: dev, port: str(port) };
  const text = str(row[side]).trim();
  if (!text) return { device: '', port: '' };
  const at = text.indexOf(' / ');
  return at < 0 ? { device: text, port: '' } : { device: text.slice(0, at), port: text.slice(at + 3) };
}

/** A run read from a bench that has no cable: written as a bare link, not as a cable. */
export function isBareLink(row) {
  if (!row.kind || row.cable || num(row.lengthMm) != null) return false;
  return row.type === [row.kind, row.medium].filter(Boolean).join(', ') || row.type === 'link';
}

/** The run's length in mm: its own lengthMm, else lenFt × 304.8; null when unknown (0 ft is not a length). */
export function lengthMmOf(row) {
  const mm = num(row.lengthMm);
  if (mm != null && mm >= 0) return mm;
  const ft = num(row.lenFt);
  return ft != null && ft > 0 ? Math.round(ft * MM_PER_FT * 1e6) / 1e6 : null;
}

class Writer {
  constructor() { this.entities = []; }
  add(type, ...args) {
    const id = this.entities.length + 1;
    this.entities.push({ id, type, args });
    return ref(id);
  }
}

const wiresOf = (input) => (Array.isArray(input) ? input : Array.isArray(input?.wires) ? input.wires : []);

/**
 * The wirelist (a WirelistModel, its block, or a list of runs) as IFC4X3_ADD2 STEP text.
 * `name` is the file stem; the project GlobalId is uuid5 of wirelist/<name>, so a schedule saved under
 * the same name keeps every GlobalId.
 */
export function wirelistToIfc(input, { name = 'wirelist' } = {}) {
  const wires = wiresOf(input);
  const W = new Writer();
  const P = ifcGuid('wirelist', name);
  const rel = (...roles) => ifcGuid('rel', ...roles);

  // ---- units, context, the spine
  const mm = W.add('IFCSIUNIT', { kind: 'derived' }, enumv('LENGTHUNIT'), enumv('MILLI'), enumv('METRE'));
  const units = W.add('IFCUNITASSIGNMENT', [mm]);
  const origin = W.add('IFCAXIS2PLACEMENT3D', W.add('IFCCARTESIANPOINT', [real(0), real(0), real(0)]), null, null);
  const ctx = W.add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, real(1e-5), origin, null);
  const project = W.add('IFCPROJECT', P, null, name, 'Wirelist Editor cable schedule', null, null, null, [ctx], units);
  const sitePl = W.add('IFCLOCALPLACEMENT', null, origin);
  const buildingPl = W.add('IFCLOCALPLACEMENT', sitePl, origin);
  const storeyPl = W.add('IFCLOCALPLACEMENT', buildingPl, origin);
  const siteGid = ifcGuid('site', P, 'site');
  const buildingGid = ifcGuid('site', P, 'building');
  const storeyGid = ifcGuid('site', P, 'storey');
  const site = W.add('IFCSITE', siteGid, null, 'Site', null, null, sitePl, null, null, enumv('ELEMENT'), null, null, null, null, null);
  const building = W.add('IFCBUILDING', buildingGid, null, 'Building', null, null, buildingPl, null, null, enumv('ELEMENT'), null, null, null);
  const storey = W.add('IFCBUILDINGSTOREY', storeyGid, null, 'Cable schedule', null, null, storeyPl, null, null, enumv('ELEMENT'), real(0));
  W.add('IFCRELAGGREGATES', rel('aggregates', P), null, null, null, project, [site]);
  W.add('IFCRELAGGREGATES', rel('aggregates', siteGid), null, null, null, site, [building]);
  W.add('IFCRELAGGREGATES', rel('aggregates', buildingGid), null, null, null, building, [storey]);

  const pset = (owners, ownerGid, setName, list) => {
    const props = list.filter(([, v]) => v != null && v !== '').map(([n, v]) => W.add('IFCPROPERTYSINGLEVALUE', n, null, v, null));
    if (!props.length) return;
    const ps = W.add('IFCPROPERTYSET', ifcGuid('rel', 'pset', ownerGid, setName), null, setName, null, props);
    W.add('IFCRELDEFINESBYPROPERTIES', ifcGuid('rel', 'props', ownerGid, setName), null, null, null, owners, ps);
  };
  const contained = [];
  const nests = [];   // [host ref, host gid, [port refs]] — written at the end, ports in order

  // ---- devices: one per identity (a MAC, a serial, else the name); a bare name binds to the one identity it has
  const idOf = new Map();   // device name -> its first identity key
  for (const w of wires) {
    const { device } = endOf(w, 'from');
    const mac = str(w.fromMac).toLowerCase();
    const serial = str(w.fromSerial);
    if (device && (mac || serial) && !idOf.has(device)) idOf.set(device, mac ? `mac:${mac}` : `serial:${serial}`);
  }
  const identityOf = new Map();   // mac key -> { serial } (a run that names both)
  for (const w of wires) {
    const mac = str(w.fromMac).toLowerCase();
    if (mac && str(w.fromSerial) && !identityOf.has(`mac:${mac}`)) identityOf.set(`mac:${mac}`, { serial: str(w.fromSerial) });
  }
  const devices = new Map();   // key -> { ref, gid, ports: Map(portName -> uses), list: [] }
  const deviceFor = (name, identity) => {
    const key = identity || idOf.get(name) || `name:${name}`;
    if (devices.has(key)) return devices.get(key);
    const gid = key.startsWith('mac:') ? ifcGuid('inst', key) : ifcGuid('decl', P, 'device', key);
    const el = W.add('IFCDISTRIBUTIONELEMENT', gid, null, name, null, null, null, null, name);
    const d = { ref: el, gid, uses: new Map(), list: [] };
    devices.set(key, d);
    contained.push(el);
    nests.push([el, gid, d.list]);
    if (key.startsWith('mac:')) pset([el], gid, 'APK_Identity', [['IdentityKey', ident(key)], ['MacAddress', ident(key.slice(4))]]);
    else if (key.startsWith('serial:')) {
      pset([el], gid, 'APK_Identity', [['IdentityKey', ident(key)]]);
      pset([el], gid, 'Pset_ManufacturerOccurrence', [['SerialNumber', ident(key.slice(7))]]);
    }
    if (key.startsWith('mac:') && str(identityOf.get(key)?.serial)) {
      pset([el], gid, 'Pset_ManufacturerOccurrence', [['SerialNumber', ident(identityOf.get(key).serial)]]);
    }
    return d;
  };

  /** The device port a run's end lands on: its own the first time, a fan-out port after that. */
  const portFor = (d, portName, wireKey, flow, sysType, connector) => {
    const n = d.uses.get(portName) || 0;
    d.uses.set(portName, n + 1);
    const fan = n > 0;
    const gid = fan ? ifcGuid(d.gid, 'port', portName, 'fan', wireKey) : ifcGuid(d.gid, 'port', portName);
    const nameOut = fan ? `${portName} / ${wireKey}` : portName || null;
    const p = W.add('IFCDISTRIBUTIONPORT', gid, null, nameOut, null, null, null, null, enumv(flow), enumv('CABLE'), (sysType ? enumv(sysType) : null));
    d.list.push(p);
    pset([p], gid, 'APK_Terminal', [
      ...(fan ? [['FansOutOf', ident(`port:${portName}`)]] : []),
      ...(!fan && connector ? [['Connector', label(connector)]] : []),
    ]);
    return { ref: p, gid };
  };

  // ---- cable types, once each
  const types = new Map();   // type text -> { ref, gid, occ: [] }
  const typeFor = (text) => {
    if (types.has(text)) return types.get(text);
    const gid = ifcGuid('decl', P, 'cabletype', text);
    const t = W.add('IFCCABLESEGMENTTYPE', gid, null, text, null, null, null, null, null, null, enumv('CABLESEGMENT'));
    types.set(text, { ref: t, gid, occ: [] });
    return types.get(text);
  };

  // ---- systems, once each
  const systems = new Map();   // name -> { ref, gid, members: [] }
  const systemFor = (sysName, sysType, row) => {
    if (systems.has(sysName)) return systems.get(sysName);
    const gid = ifcGuid('decl', P, 'system', sysName);
    const s = W.add('IFCDISTRIBUTIONSYSTEM', gid, null, sysName, null, null, null, (sysType ? enumv(sysType) : null));
    const pre = `${str(row.signal) || '-'}/${row.medium === 'wireless' ? 'wireless' : 'wired'}/`;
    pset([s], gid, 'Pset_DistributionSystemCommon', [['Reference', ident(pre + sysName)]]);
    systems.set(sysName, { ref: s, gid, members: [] });
    return systems.get(sysName);
  };

  // ---- the runs
  const taken = new Set();
  wires.forEach((w, i) => {
    let key = str(w.id) || `run-${i + 1}`;
    while (taken.has(key)) key = `${key}#${i + 1}`;
    taken.add(key);
    const sysName = str(w.system) || str(w.signal);
    const sysType = !sysName ? null : SYSTEM_TYPES.has(w.systemType) ? w.systemType : systemTypeOf(sysName);
    const sys = sysName ? systemFor(sysName, sysType, w) : null;
    const A = endOf(w, 'from');
    const B = endOf(w, 'to');
    const fromMac = str(w.fromMac).toLowerCase();
    const devA = A.device ? deviceFor(A.device, fromMac ? `mac:${fromMac}` : str(w.fromSerial) ? `serial:${str(w.fromSerial)}` : '') : null;
    const devB = B.device ? deviceFor(B.device, '') : null;
    const connName = str(w.connection) || key;
    const connProps = [
      ['ConnectionId', w.connection && w.connection !== key ? ident(w.connection) : null],   // else the relationship's Name says it
      ['Kind', w.kind ? label(w.kind) : null],
      ['Medium', w.medium ? label(w.medium) : null],
      ['Domain', str(w.signal) ? label(w.signal) : null],
    ];

    if (isBareLink(w)) {
      if (!devA || !devB) return;   // a bare link is its two ends; one with an end missing is not a link
      const pa = portFor(devA, A.port, key, 'SOURCE', sysType, w.fromConnector);
      const pb = portFor(devB, B.port, key, 'SINK', sysType, w.toConnector);
      W.add('IFCRELCONNECTSPORTS', rel('connects', P, key), null, connName, null, pa.ref, pb.ref, null);
      pset([pa.ref], pa.gid, 'APK_Connection', connProps);
      if (sys) {
        for (const d of [devA, devB]) if (!sys.members.includes(d.ref)) sys.members.push(d.ref);
      }
      return;
    }

    const gid = ifcGuid('decl', P, 'cable', key);
    const typeText = str(w.type);
    const t = typeText ? typeFor(typeText) : null;
    const cable = W.add('IFCCABLESEGMENT', gid, null, key, null, null, null, null, key, t ? null : enumv('CABLESEGMENT'));
    if (t) t.occ.push(cable);
    contained.push(cable);
    const endA = W.add('IFCDISTRIBUTIONPORT', ifcGuid(gid, 'end', 'A'), null, 'A', null, null, null, null, enumv('SINK'), enumv('CABLE'), (sysType ? enumv(sysType) : null));
    const endB = W.add('IFCDISTRIBUTIONPORT', ifcGuid(gid, 'end', 'B'), null, 'B', null, null, null, null, enumv('SOURCE'), enumv('CABLE'), (sysType ? enumv(sysType) : null));
    nests.push([cable, gid, [endA, endB]]);
    if (devA) {
      const pa = portFor(devA, A.port, key, 'SOURCE', sysType, w.fromConnector);
      W.add('IFCRELCONNECTSPORTS', rel('connects', P, key, 'A'), null, connName, null, pa.ref, endA, null);
    }
    if (devB) {
      const pb = portFor(devB, B.port, key, 'SINK', sysType, w.toConnector);
      W.add('IFCRELCONNECTSPORTS', rel('connects', P, key, 'B'), null, connName, null, endB, pb.ref, null);
    }
    pset([cable], gid, 'APK_Connection', [
      ...connProps,
      ['CableStatus', str(w.status) ? label(w.status) : null],
      ['CableColour', str(w.color) ? label(w.color) : null],
    ]);
    const len = lengthMmOf(w);
    if (len != null) {
      const q = W.add('IFCQUANTITYLENGTH', 'Length', null, null, real(len), null);
      const qto = W.add('IFCELEMENTQUANTITY', ifcGuid('rel', 'pset', gid, 'Qto_CableSegmentBaseQuantities'), null, 'Qto_CableSegmentBaseQuantities', null, null, [q]);
      W.add('IFCRELDEFINESBYPROPERTIES', ifcGuid('rel', 'props', gid, 'Qto_CableSegmentBaseQuantities'), null, null, null, [cable], qto);
    }
    if (sys) sys.members.push(cable);
  });

  // ---- nesting, types, systems, containment
  for (const [host, gid, list] of nests) if (list.length) W.add('IFCRELNESTS', rel('nests', gid), null, null, null, host, list);
  const typeList = [...types.values()];
  if (typeList.length) W.add('IFCRELDECLARES', rel('declares', P), null, null, null, project, typeList.map((t) => t.ref));
  for (const t of typeList) if (t.occ.length) W.add('IFCRELDEFINESBYTYPE', rel('type', t.gid), null, null, null, t.occ, t.ref);
  for (const s of systems.values()) if (s.members.length) W.add('IFCRELASSIGNSTOGROUP', rel('group', s.gid), null, null, null, s.members, null, s.ref);
  if (contained.length) W.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', rel('contains', storeyGid), null, null, null, contained, storey);

  const header = [
    { type: 'FILE_DESCRIPTION', args: [['ViewDefinition [ReferenceView]'], '2;1'] },
    { type: 'FILE_NAME', args: [`${name}.ifc`, '2026-01-01T00:00:00', ['APK.audio'], ['APK.audio'], 'Wirelist Editor', 'Wirelist Editor cable schedule', ''] },
    { type: 'FILE_SCHEMA', args: [[WIRELIST_IFC_SCHEMA]] },
  ];
  return writeStep({ header, entities: W.entities });
}
