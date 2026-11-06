// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* wirelistIfc.js — THE WIRELIST AS A QUERY OVER AN IFC MODEL (cabling-4). A rig or bench .ifc
   (GET /api/bim/bench.ifc, DATABASE.server.BIM bim/bench_ifc.py, or any IFC4X3 / IFC4 / IFC2X3 file)
   is read with the contracts STEP codec (js/ifc/step.mjs = contracts/src/ifc/step.ts) and every
   run is worked out from its IfcRelConnectsPorts:

     a cable       an IfcCableSegment with its end ports nested in order (A, then B), each joined by
                   one IfcRelConnectsPorts to a device port — one row per cable, A end = what its
                   first port meets, B end = its second; or an IfcRelConnectsPorts whose
                   RealizingElement is the cable (the IFC2X3 way) — Relating = A, Related = B
     a bare link   an IfcRelConnectsPorts between two device ports with no cable (assumed or
                   wireless on the bench) — Relating = A, Related = B

   Each end is the element that nests the port (IfcRelNests; IFC2X3 IfcRelConnectsPortToElement):
   device = its Tag (the bench ref) or Name, port = the port's Name, connector = APK_Terminal.Connector,
   else Pset_DistributionPortTypeCable.ConnectionSubtype / ElectricalConnectionType. A bench fan-out
   port ('<terminal> / <id>', APK_Terminal.FansOutOf) answers for its terminal. The system is the
   IfcDistributionSystem (IfcRelAssignsToGroup) holding the cable, else holding both devices — the
   one whose Pset_DistributionSystemCommon.Reference is <domain>/<medium>/… when there are several.
   Lengths are mm (Qto_CableSegmentBaseQuantities.Length, scaled by the file's length unit). */

import * as ifc from './ifc/step.mjs';
import { FT_TO_M, WIRE_STATUSES } from './wirelistModel.js';

const NOT_A_CONNECTOR = new Set(['NOTKNOWN', 'NOTDEFINED', 'UNSET', 'USERDEFINED']);
const CABLES = new Set(['IFCCABLESEGMENT']);

const words = (v) => (Array.isArray(v) ? v.filter((x) => x != null && x !== '').join(' / ') : v == null ? '' : String(v));
const isRef = (v) => v && typeof v === 'object' && v.kind === 'ref';
const enumOf = (v) => (v && typeof v === 'object' && v.kind === 'enum' ? v.value : '');
const text = (v) => (typeof v === 'string' ? v : '');

/** mm per unit of the file's IfcSIUnit LENGTHUNIT (1 when it is the millimetre, as APK writes). */
function mmPerLengthUnit(file) {
  const prefix = { MILLI: 1, CENTI: 10, DECI: 100, KILO: 1e6 };
  for (const u of ifc.entitiesByType(file, 'IFCSIUNIT')) {
    if (enumOf(u.args[1]) !== 'LENGTHUNIT') continue;
    const p = enumOf(u.args[2]);
    return p ? prefix[p] ?? 1000 : 1000;
  }
  return 1;
}

/** The element a port belongs to: IfcRelNests (IFC4+) or IfcRelConnectsPortToElement (IFC2X3). */
function owners(file) {
  const out = new Map();
  for (const rel of ifc.entitiesByType(file, 'IFCRELNESTS')) {
    const host = ifc.deref(file, rel.args[4]);
    if (!host) continue;
    for (const r of Array.isArray(rel.args[5]) ? rel.args[5] : []) {
      const p = isRef(r) && file.byId.get(r.id);
      if (p && p.type === 'IFCDISTRIBUTIONPORT' && !out.has(p.id)) out.set(p.id, host);
    }
  }
  for (const rel of ifc.entitiesByType(file, 'IFCRELCONNECTSPORTTOELEMENT')) {
    const p = ifc.deref(file, rel.args[4]);
    const el = ifc.deref(file, rel.args[5]);
    if (p && el && !out.has(p.id)) out.set(p.id, el);
  }
  return out;
}

/** element id -> the IfcDistributionSystems (and IfcSystems) that group it. */
function systemsOf(file) {
  const out = new Map();
  for (const rel of ifc.entitiesByType(file, 'IFCRELASSIGNSTOGROUP')) {
    const g = ifc.deref(file, rel.args[6]);
    if (!g || !/^IFC(DISTRIBUTION|BUILDING)?SYSTEM$|^IFCDISTRIBUTIONCIRCUIT$/.test(g.type)) continue;
    for (const r of Array.isArray(rel.args[4]) ? rel.args[4] : []) {
      if (!isRef(r)) continue;
      const list = out.get(r.id) || [];
      if (!list.includes(g)) list.push(g);
      out.set(r.id, list);
    }
  }
  return out;
}

/** Read an IFC text (or an already parsed StepFile) into wirelist rows. Throws a StepError on a malformed file. */
export function wirelistFromIfc(input) {
  const file = typeof input === 'string' ? ifc.parseStep(input) : input;
  const owner = owners(file);
  const systems = systemsOf(file);
  const mm = mmPerLengthUnit(file);
  const psetCache = new Map();
  const psets = (e) => {
    if (!psetCache.has(e.id)) psetCache.set(e.id, ifc.getPsets(file, e));
    return psetCache.get(e.id);
  };
  const portsCache = new Map();
  const portsOf = (el) => {
    if (!portsCache.has(el.id)) portsCache.set(el.id, ifc.ports(file, el));
    return portsCache.get(el.id);
  };

  /** A fan-out port answers for the terminal it fans out of (the bench's '<terminal> / <id>'). */
  const mainPort = (p) => {
    const fan = psets(p).APK_Terminal?.FansOutOf;
    const el = owner.get(p.id);
    if (!fan || !el) return p;
    return portsOf(el).find((q) => {
      const t = psets(q).APK_Terminal || {};
      return !t.FansOutOf && (t.Pin === fan || `port:${text(q.args[2])}` === fan);
    }) || p;
  };

  const connectorOf = (p) => {
    const s = psets(p);
    if (s.APK_Terminal?.Connector) return words(s.APK_Terminal.Connector);
    const cab = s.Pset_DistributionPortTypeCable || {};
    for (const k of ['ConnectionSubtype', 'ElectricalConnectionType']) {
      const v = words(cab[k]);
      if (v && !NOT_A_CONNECTOR.has(v)) return v;
    }
    return '';
  };

  const end = (p) => {
    if (!p) return { device: '', deviceName: '', port: '', connector: '', element: null, systemType: '' };
    const m = mainPort(p);
    const el = owner.get(p.id) || null;
    return {
      device: el ? text(el.args[7]) || text(el.args[2]) : '',
      deviceName: el ? text(el.args[2]) : '',
      port: text(m.args[2]),
      connector: connectorOf(m),
      element: el,
      systemType: enumOf(p.args[9]),
    };
  };

  const pickSystem = (els, conn, systemType) => {
    const lists = els.filter(Boolean).map((e) => systems.get(e.id) || []);
    if (!lists.length) return null;
    const both = lists[0].filter((s) => lists.every((l) => l.includes(s)));
    if (!both.length) return null;
    if (conn.Domain || conn.Medium) {
      const pre = `${conn.Domain || '-'}/${conn.Medium === 'wireless' ? 'wireless' : 'wired'}/`;
      const hit = both.find((s) => String(psets(s).Pset_DistributionSystemCommon?.Reference || '').startsWith(pre));
      if (hit) return hit;
    }
    return both.find((s) => systemType && enumOf(s.args[6]) === systemType) || both[0];
  };

  const typeName = (el) => {
    for (const rel of ifc.entitiesByType(file, 'IFCRELDEFINESBYTYPE')) {
      if ((rel.args[4] || []).some((r) => isRef(r) && r.id === el.id)) {
        const t = ifc.deref(file, rel.args[5]);
        if (t) return text(t.args[2]);
      }
    }
    return '';
  };

  const row = ({ rel, cable, a, b, conn }) => {
    const A = end(a);
    const B = end(b);
    conn = conn || {};
    const sys = cable ? pickSystem([cable], conn, '') : pickSystem([A.element, B.element], conn, A.systemType || B.systemType);
    const qto = cable ? psets(cable).Qto_CableSegmentBaseQuantities || {} : {};
    const lengthMm = typeof qto.Length === 'number' ? Math.round(qto.Length * mm * 1000) / 1000 : null;
    const tag = cable ? text(cable.args[7]) : '';
    const connection = text(conn.ConnectionId) || (rel ? text(rel.args[2]) : '') || (cable ? text(cable.args[2]) : '');
    const status = text(conn.CableStatus);
    const medium = text(conn.Medium);
    const kind = text(conn.Kind);
    return {
      id: tag || connection || (cable ? text(cable.args[0]) : rel ? text(rel.args[0]) : ''),
      connection,
      cable: tag,
      type: (cable && (typeName(cable) || text(conn.CablePart)
        || (text(cable.args[2]) !== connection && text(cable.args[2])) || 'Cable'))
        || [kind, medium].filter(Boolean).join(', ') || 'link',
      lengthMm,
      lenFt: lengthMm == null ? 0 : Math.round((lengthMm / 1000 / FT_TO_M) * 10) / 10,
      from: [A.device, A.port].filter(Boolean).join(' / '),
      to: [B.device, B.port].filter(Boolean).join(' / '),
      fromDevice: A.device, fromPort: A.port, fromConnector: A.connector,
      toDevice: B.device, toPort: B.port, toConnector: B.connector,
      system: sys ? text(sys.args[2]) : '',
      systemType: sys ? enumOf(sys.args[6]) : '',
      signal: text(conn.Domain) || (A.systemType || B.systemType || '').toLowerCase(),
      color: text(conn.CableColour),
      status: WIRE_STATUSES.includes(status) ? status : '',
      kind,
      medium,
      source: 'ifc',
    };
  };

  const isCable = (el) => !!el && CABLES.has(el.type);
  const rows = [];
  const seenCable = new Set();
  const conns = ifc.connections(file);
  const byCablePort = new Map();   // cable port id -> the device port it meets
  for (const c of conns) {
    const ea = c.relating && owner.get(c.relating.id);
    const eb = c.related && owner.get(c.related.id);
    if (isCable(ea) && !isCable(eb)) byCablePort.set(c.relating.id, { other: c.related, rel: c.rel });
    else if (isCable(eb) && !isCable(ea)) byCablePort.set(c.related.id, { other: c.relating, rel: c.rel });
  }
  for (const c of conns) {
    const ea = c.relating && owner.get(c.relating.id);
    const eb = c.related && owner.get(c.related.id);
    if (c.realizing) {
      rows.push(row({ rel: c.rel, cable: c.realizing, a: c.relating, b: c.related, conn: psets(c.realizing).APK_Connection }));
      continue;
    }
    if (!isCable(ea) && !isCable(eb)) {
      const conn = (c.relating && psets(c.relating).APK_Connection) || (c.related && psets(c.related).APK_Connection);
      rows.push(row({ rel: c.rel, a: c.relating, b: c.related, conn }));
      continue;
    }
    const cable = isCable(ea) ? ea : eb;
    if (seenCable.has(cable.id)) continue;
    seenCable.add(cable.id);
    const [pa, pb] = portsOf(cable);
    const A = pa && byCablePort.get(pa.id);
    const B = pb && byCablePort.get(pb.id);
    rows.push(row({ rel: (A || B || c).rel, cable, a: A && A.other, b: B && B.other, conn: psets(cable).APK_Connection }));
  }
  // a cable in the model that nothing is plugged into yet is still a run on the schedule
  for (const el of ifc.entitiesByType(file, 'IFCCABLESEGMENT')) {
    if (!seenCable.has(el.id)) rows.push(row({ cable: el, conn: psets(el).APK_Connection }));
  }
  return rows;
}

/** The schema id of a file, for the page's tag ('IFC4X3_ADD2'). */
export const schemaOf = (input) => ifc.schemaOf(typeof input === 'string' ? ifc.parseStep(input) : input);
