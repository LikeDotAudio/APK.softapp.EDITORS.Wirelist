// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* wirelistRowIfc.js — the schedule table's row→IFC mapping (ROAD-3598: every table offers IFC beside
   CSV). APKTable 'wirelist-runs' takes it as opts.ifc: each run shown is one IfcCableSegment
   CABLESEGMENT (Name = Tag = the wire number, ObjectType the cable type, Description origin → destination),
   Qto_CableSegmentBaseQuantities.Length in mm (lengthMm, else lenFt × 304.8), and APK_Connection
   (ConnectionId, Domain = the signal type, CableStatus, CableColour). Save writes the full model with both
   ends' ports joined (wirelistToIfc.js); this is the table as rows. */
import { FT_TO_M } from './wirelistModel.js';

export function wirelistRowIfc(model) {
  return {
    file: 'facility_wirelist',
    project: 'Wirelist',
    get roles() { return ['wirelist', model?.id || 'wirelist', 'table']; },
    row: (r) => {
      const mm = Number(r.lengthMm) > 0 ? Number(r.lengthMm) : Number(r.lenFt) > 0 ? Number(r.lenFt) * FT_TO_M * 1000 : null;
      return {
        entity: 'IfcCableSegment',
        predefined: 'CABLESEGMENT',
        key: r.id,
        name: r.id || null,
        tag: r.id || null,
        objectType: r.type || null,
        description: r.from || r.to ? `${r.from || '?'} → ${r.to || '?'}` : null,
        psets: {
          APK_Connection: {
            ConnectionId: r.id ? { value: r.id, measure: 'IfcIdentifier' } : null,
            Domain: r.signal || null,
            CableStatus: r.status || null,
            CableColour: r.color || null,
          },
        },
        quantities: mm ? { Qto_CableSegmentBaseQuantities: { Length: { kind: 'LENGTH', value: Math.round(mm * 1000) / 1000 } } } : {},
      };
    },
  };
}
