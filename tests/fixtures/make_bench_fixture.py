# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""The Wirelist's IFC fixture: the seed bench as DATABASE.server.BIM serves it at GET /api/bim/bench.ifc
(bim/bench_ifc.py), after two cables are patched in through the real route code (Bench.put_connection,
which writes bench.json and its bench.ifc twin). Writes, beside this file:

    seed-bench.ifc.gz         the stored twin, gzipped (mtime 0, so the bytes are deterministic)
    seed-bench.expected.json  the wirelist the file must give, worked out WITHOUT the STEP codec:
                              ids, devices, ports, domain, medium and cable facts from the bench JSON;
                              connectors and systems from IfcOpenShell when it can be imported (else
                              left out, and the test checks only what is there)

Run from the monorepo checkout (the BIM server sits at its usual place), with IfcOpenShell for the full
expectation:   python -I tests/fixtures/make_bench_fixture.py
"""
import gzip
import io
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MONO = HERE.parents[6]
SRC = MONO / "PODS" / "POD.database" / "DATABASE.server.BIM" / "SRC"
sys.path.insert(0, str(SRC))
from bim import bench_ifc as B  # noqa: E402
from bim import ifc  # noqa: E402
from bim.bench import Bench  # noqa: E402
from bim.store import Library  # noqa: E402

SEED = SRC / "bench" / "seed.bench.json"


def unused(doc, side, domain, avoid=()):
    used = {B._end_key(c[e]) for c in doc["connections"] for e in ("a", "b")}
    free = [(i["ref"], t) for i in doc["instances"] for t in i["terminals"]
            if t.get("side") == side and t.get("domain") == domain and i["ref"] not in avoid
            and ("pin", i["ref"], t["pin"]) not in used]
    return sorted(free, key=lambda x: not x[1].get("connector"))   # a terminal that names its connector first


def cable_part(lib):
    """The first library part that is written as an IfcCableSegmentType (so the cable is typed)."""
    for pid in sorted(lib.parts):
        part = lib.get(pid)
        if part and (ifc.type_for(part) or {}).get("entity") == "IfcCableSegmentType":
            return pid
    return None


def expected(doc):
    rows = []
    for c in doc["connections"]:
        cab = c.get("cable") or {}
        end = lambda e: {"device": e["ref"], "port": e.get("terminal") or e.get("port")}  # noqa: E731
        rows.append({"connection": c["id"], "cable": cab.get("tag") or "", "lengthMm": cab.get("length_mm"),
                     "color": cab.get("colour") or "", "status": cab.get("status") or "", "cablePart": cab.get("part") or "",
                     "kind": c.get("kind"), "medium": c.get("medium"), "signal": c.get("domain") or "",
                     "a": end(c["a"]), "b": end(c["b"]), "cabled": B.is_cabled(c)})
    return rows


def with_ifcopenshell(text, rows):
    """Connectors and systems per connection, read by IfcOpenShell — an oracle independent of step.ts."""
    try:
        import ifcopenshell
        import ifcopenshell.util.element as E
        import ifcopenshell.util.system as U
    except ImportError:
        return False
    f = ifcopenshell.file.from_string(text)

    def main_port(p):
        el = U.get_port_element(p)
        t = E.get_psets(p).get("APK_Terminal", {})
        fan = t.get("FansOutOf")
        if not fan:
            return p
        for q in U.get_ports(el):
            qt = E.get_psets(q).get("APK_Terminal", {})
            if qt.get("Pin") == fan or ("port:" + str(q.Name) == fan and not qt.get("FansOutOf")):
                return q
        return p

    def connector(p):
        p = main_port(p)
        ps = E.get_psets(p)
        own = ps.get("APK_Terminal", {}).get("Connector")
        if own:
            return own
        cab = ps.get("Pset_DistributionPortTypeCable", {})
        for k in ("ConnectionSubtype", "ElectricalConnectionType"):
            v = cab.get(k)
            v = " / ".join(v) if isinstance(v, (list, tuple)) else v
            if v and v not in ("NOTKNOWN", "NOTDEFINED", "UNSET"):
                return v
        return ""

    systems = {}
    for s in f.by_type("IfcDistributionSystem"):
        for rel in s.IsGroupedBy:
            for o in rel.RelatedObjects:
                systems.setdefault(o.id(), []).append(s)
    by_id = {r["connection"]: r for r in rows}
    for rel in f.by_type("IfcRelConnectsPorts"):
        row = by_id[rel.Name]
        a, b = rel.RelatingPort, rel.RelatedPort
        ea, eb = U.get_port_element(a), U.get_port_element(b)
        if ea.is_a("IfcCableSegment") or eb.is_a("IfcCableSegment"):
            cab, dev_port = (ea, b) if ea.is_a("IfcCableSegment") else (eb, a)
            side = "a" if U.get_ports(cab).index(a if cab == ea else b) == 0 else "b"
            row[side]["connector"] = connector(dev_port)
            row["system"] = [s.Name for s in systems.get(cab.id(), [])][0] if systems.get(cab.id()) else ""
        else:
            row["a"]["connector"], row["b"]["connector"] = connector(a), connector(b)
            both = [s for s in systems.get(ea.id(), []) if s in systems.get(eb.id(), [])]
            ref = "%s/%s/" % (row["signal"] or "-", "wireless" if row["medium"] == "wireless" else "wired")
            pick = [s for s in both if str(E.get_psets(s).get("Pset_DistributionSystemCommon", {}).get("Reference", "")).startswith(ref)]
            row["system"] = (pick or both)[0].Name if (pick or both) else ""
    return True


def main():
    lib = Library(SRC / "library")
    lib.get("")
    with tempfile.TemporaryDirectory() as tmp:
        bench = Bench(lib, tmp, SEED)
        out1 = unused(bench.doc, "output", "audio")[0]
        in1 = next(x for x in unused(bench.doc, "input", "audio") if x[0] != out1[0])
        bench.put_connection("Bench:X1", {"a": {"ref": out1[0], "pin": out1[1]["pin"]}, "b": {"ref": in1[0], "pin": in1[1]["pin"]},
                                          "domain": "audio", "why": "patched on the bay",
                                          "cable": {"tag": "W-001", "length_mm": 1500, "colour": "Blue", "status": "Pulled"}})
        out2 = unused(bench.doc, "output", "audio")[0]
        in2 = next(x for x in unused(bench.doc, "input", "audio") if x[0] != out2[0])
        cable = {"tag": "W-002", "length_mm": 3048, "colour": "Black", "status": "Terminated"}
        pid = cable_part(lib)
        if pid:
            cable["part"] = pid
        bench.put_connection("Bench:X2", {"a": {"ref": out2[0], "pin": out2[1]["pin"]}, "b": {"ref": in2[0], "pin": in2[1]["pin"]},
                                          "domain": "audio", "why": "second run", "cable": cable})
        text = Path(tmp, "bench.ifc").read_text("utf-8")
        state = json.loads(Path(tmp, "bench.json").read_text("utf-8"))
    assert text == bench.ifc(), "the stored twin is what GET /api/bim/bench.ifc serves"
    rows = expected(state)
    full = with_ifcopenshell(text, rows)
    buf = io.BytesIO()
    with gzip.GzipFile(filename="seed-bench.ifc", mode="wb", fileobj=buf, mtime=0, compresslevel=9) as gz:
        gz.write(text.encode("utf-8"))
    (HERE / "seed-bench.ifc.gz").write_bytes(buf.getvalue())
    (HERE / "seed-bench.expected.json").write_text(json.dumps({
        "source": "DATABASE.server.BIM bim/bench_ifc.py, seed bench + Bench:X1, Bench:X2 patched through Bench.put_connection",
        "ifcopenshell": full, "rows": rows}, indent=1, ensure_ascii=False) + "\n", "utf-8")
    print("wrote seed-bench.ifc.gz (%d bytes, %d raw) and %d expected rows (connectors/systems by IfcOpenShell: %s)"
          % (len(buf.getvalue()), len(text), len(rows), full))


if __name__ == "__main__":
    main()
