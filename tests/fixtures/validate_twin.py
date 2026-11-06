# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""The IfcOpenShell check of a wirelist .ifc twin (js/wirelistToIfc.js). Test-time only: IfcOpenShell is
LGPL and never vendored, never loaded by the page.

    node -e "..." > wirelist.ifc     (any twin the editor saved)
    python3 -I tests/fixtures/validate_twin.py wirelist.ifc [more.ifc ...]

prints one JSON object per file: the schema, IfcOpenShell validate statements (EXPRESS rules on), the BIM
oracle's pset problems (every Pset_/Qto_ against the IFC4X3 templates, every APK_ set against
DATABASE.server.BIM tools/ifc/apk_psets.py) when that repo sits beside this app, and every cable traced the
IfcOpenShell way (util.system get_ports -> get_connected_port -> get_port_element): [tag, A device, A port,
B device, B port]. Exit 1 on any statement or pset problem, or a cable whose end ports are not A then B.
"""
import json
import sys
from pathlib import Path

import ifcopenshell
import ifcopenshell.util.system as S
import ifcopenshell.validate

ORACLE = Path(__file__).resolve().parents[7] / "PODS/POD.database/DATABASE.server.BIM/SRC/tools/ifc"


def oracle():
    if (ORACLE / "oracle.py").exists():
        sys.path.insert(0, str(ORACLE))
        import oracle as o  # noqa: E402
        return o
    return None


def main(paths):
    o = oracle()
    worst = 0
    for path in paths:
        f = ifcopenshell.open(path)
        log = ifcopenshell.validate.json_logger()
        ifcopenshell.validate.validate(f, log, express_rules=True)
        pp = o.pset_problems(f) if o else None
        runs, bad = [], []
        for c in f.by_type("IfcCableSegment"):
            ends = S.get_ports(c)
            if [p.Name for p in ends] != ["A", "B"]:
                bad.append(c.Tag)
            row = [c.Tag]
            for p in ends:
                q = S.get_connected_port(p)
                el = S.get_port_element(q) if q else None
                row += [el.Tag if el else None, q.Name if q else None]
            runs.append(row)
        print(json.dumps({"file": path, "schema": f.schema_identifier, "statements": len(log.statements),
                          "first": [str(s)[:200] for s in log.statements[:5]], "pset_problems": pp,
                          "cables": len(runs), "bad_ends": bad, "runs": runs[:10]}))
        if log.statements or pp or bad:
            worst = 1
    return worst


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
