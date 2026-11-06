// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// GENERATED — do not edit. The contracts STEP codec (ISO 10303-21 reader/writer), contracts/src/ifc/step.ts,
// as plain ES module JS for a page with no build. Regenerate: node tests/fixtures/make_step_codec.mjs
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const DERIVED = Object.freeze({ kind: "derived" });
const real = (value) => ({ kind: "real", value });
const enumv = (value) => ({ kind: "enum", value });
const ref = (id) => ({ kind: "ref", id });
const typed = (type, value) => ({ kind: "typed", type, value });
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isRef = (v) => v != null && isObj(v) && v.kind === "ref";
class Reader {
  constructor(s) {
    __publicField(this, "s", s);
    __publicField(this, "i", 0);
  }
  fail(msg) {
    const line = this.s.slice(0, this.i).split("\n").length;
    throw new Error(`STEP: ${msg} at line ${line}`);
  }
  ws() {
    for (; ; ) {
      const c = this.s.charCodeAt(this.i);
      if (c === 32 || c === 9 || c === 10 || c === 13) this.i++;
      else if (c === 47 && this.s[this.i + 1] === "*") {
        const end = this.s.indexOf("*/", this.i + 2);
        if (end < 0) this.fail("unterminated comment");
        this.i = end + 2;
      } else return;
    }
  }
  peek() {
    this.ws();
    return this.s[this.i] ?? "";
  }
  eat(ch) {
    if (this.peek() !== ch) this.fail(`expected '${ch}'`);
    this.i++;
  }
  keyword() {
    this.ws();
    const m = /^!?[A-Za-z_][A-Za-z0-9_-]*/.exec(this.s.slice(this.i, this.i + 256));
    if (!m) this.fail("expected a keyword");
    this.i += m[0].length;
    return m[0].toUpperCase();
  }
  /** `KEYWORD(params)` */
  record() {
    const type = this.keyword();
    return { type, args: this.list() };
  }
  list() {
    this.eat("(");
    const out = [];
    if (this.peek() === ")") {
      this.i++;
      return out;
    }
    for (; ; ) {
      out.push(this.value());
      const c = this.peek();
      this.i++;
      if (c === ")") return out;
      if (c !== ",") this.fail("expected ',' or ')'");
    }
  }
  value() {
    const c = this.peek();
    if (c === "'") return this.string();
    if (c === "(") return this.list();
    if (c === "$") return this.i++, null;
    if (c === "*") return this.i++, DERIVED;
    if (c === "#") {
      const m = /^#(\d+)/.exec(this.s.slice(this.i, this.i + 32));
      if (!m) this.fail("bad reference");
      this.i += m[0].length;
      return { kind: "ref", id: Number(m[1]) };
    }
    if (c === ".") {
      const m = /^\.([A-Za-z_][A-Za-z0-9_]*)\./.exec(this.s.slice(this.i, this.i + 256));
      if (!m) this.fail("bad enumeration");
      this.i += m[0].length;
      return { kind: "enum", value: m[1].toUpperCase() };
    }
    if (c === '"') {
      const end = this.s.indexOf('"', this.i + 1);
      if (end < 0) this.fail("unterminated binary");
      const value = this.s.slice(this.i + 1, end);
      this.i = end + 1;
      return { kind: "binary", value };
    }
    if (/[-+0-9]/.test(c)) {
      const m = /^[-+]?\d+(\.\d*)?([eE][-+]?\d+)?/.exec(this.s.slice(this.i, this.i + 64));
      if (!m) this.fail("bad number");
      this.i += m[0].length;
      if (m[1] === void 0 && m[2] === void 0) return Number(m[0]);
      return { kind: "real", value: Number(m[0]), raw: m[0] };
    }
    if (/[A-Za-z_!]/.test(c)) {
      const type = this.keyword();
      const args = this.list();
      return { kind: "typed", type, value: args.length === 1 ? args[0] : args };
    }
    return this.fail(`unexpected '${c}'`);
  }
  string() {
    const s = this.s;
    let i = this.i + 1;
    let out = "";
    for (; ; ) {
      const c = s[i];
      if (c === void 0) this.fail("unterminated string");
      if (c === "'") {
        if (s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        this.i = i + 1;
        return out;
      }
      if (c === "\\") {
        const rest = s.slice(i, i + 4);
        if (rest.startsWith("\\\\")) {
          out += "\\";
          i += 2;
        } else if (rest === "\\X2\\" || rest === "\\X4\\") {
          const width = rest === "\\X2\\" ? 4 : 8;
          const end = s.indexOf("\\X0\\", i + 4);
          if (end < 0) this.fail("unterminated \\X2\\ or \\X4\\");
          const hex = s.slice(i + 4, end);
          if (hex.length % width || /[^0-9A-Fa-f]/.test(hex)) this.fail("bad \\X2\\ or \\X4\\ hex");
          for (let k = 0; k < hex.length; k += width) {
            const code = parseInt(hex.slice(k, k + width), 16);
            out += width === 4 ? String.fromCharCode(code) : String.fromCodePoint(code);
          }
          i = end + 4;
        } else if (rest.startsWith("\\X\\")) {
          out += String.fromCharCode(parseInt(s.slice(i + 3, i + 5), 16));
          i += 5;
        } else if (rest.startsWith("\\S\\")) {
          out += String.fromCharCode(s.charCodeAt(i + 3) + 128);
          i += 4;
        } else if (/^\\P[A-I]\\/.test(rest)) {
          i += 4;
        } else {
          out += "\\";
          i += 1;
        }
        continue;
      }
      out += c;
      i++;
    }
  }
}
function parseStep(text) {
  const r = new Reader(text);
  const word = (w) => {
    if (r.keyword() !== w) r.fail(`expected ${w}`);
  };
  word("ISO-10303-21");
  r.eat(";");
  word("HEADER");
  r.eat(";");
  const header = [];
  for (r.ws(); !/^ENDSEC\b/i.test(text.slice(r.i, r.i + 7)); r.ws()) {
    header.push(r.record());
    r.eat(";");
  }
  word("ENDSEC");
  r.eat(";");
  word("DATA");
  if (r.peek() === "(") r.list();
  r.eat(";");
  const entities = [];
  const byId = /* @__PURE__ */ new Map();
  while (r.peek() === "#") {
    const m = /^#(\d+)/.exec(text.slice(r.i, r.i + 32));
    if (!m) r.fail("bad instance name");
    r.i += m[0].length;
    r.eat("=");
    let e;
    if (r.peek() === "(") {
      r.i++;
      const complex = [];
      while (r.peek() !== ")") complex.push(r.record());
      r.i++;
      e = { id: Number(m[1]), type: "", args: [], complex };
    } else {
      e = { id: Number(m[1]), ...r.record() };
    }
    r.eat(";");
    if (byId.has(e.id)) r.fail(`duplicate #${e.id}`);
    entities.push(e);
    byId.set(e.id, e);
  }
  word("ENDSEC");
  r.eat(";");
  word("END-ISO-10303-21");
  r.eat(";");
  return { header, entities, byId };
}
function encodeString(text) {
  let out = "'";
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (ch === "'") out += "''";
    else if (ch === "\\") out += "\\\\";
    else if (cp >= 32 && cp < 127) out += ch;
    else if (cp <= 65535) out += `\\X2\\${cp.toString(16).toUpperCase().padStart(4, "0")}\\X0\\`;
    else out += `\\X4\\${cp.toString(16).toUpperCase().padStart(8, "0")}\\X0\\`;
  }
  return out + "'";
}
function formatReal(x) {
  if (!Number.isFinite(x)) throw new Error(`STEP has no ${x}`);
  if (Number.isInteger(x) && Math.abs(x) < 1e21) return `${x.toFixed(0)}.`;
  const s = String(x);
  const m = /^(-?\d+)(\.\d+)?e([-+]\d+)$/.exec(s);
  if (!m) return s;
  return `${m[1]}${m[2] ?? "."}E${m[3].replace("+", "")}`;
}
function writeValue(v) {
  if (v === null) return "$";
  if (typeof v === "string") return encodeString(v);
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error(`STEP INTEGER expected, got ${v} (use real())`);
    return String(v);
  }
  if (Array.isArray(v)) return `(${v.map(writeValue).join(",")})`;
  switch (v.kind) {
    case "real":
      return v.raw !== void 0 && Number(v.raw) === v.value ? v.raw : formatReal(v.value);
    case "enum":
      return `.${v.value}.`;
    case "ref":
      return `#${v.id}`;
    case "typed":
      return `${v.type}(${writeValue(v.value)})`;
    case "binary":
      return `"${v.value}"`;
    case "derived":
      return "*";
  }
}
const writeRecord = (r) => `${r.type}(${r.args.map(writeValue).join(",")})`;
function writeEntity(e) {
  const body = e.complex ? `(${e.complex.map(writeRecord).join("")})` : writeRecord(e);
  return `#${e.id}=${body};`;
}
function writeStep(file) {
  return [
    "ISO-10303-21;",
    "HEADER;",
    ...file.header.map((h) => `${writeRecord(h)};`),
    "ENDSEC;",
    "DATA;",
    ...file.entities.map(writeEntity),
    "ENDSEC;",
    "END-ISO-10303-21;",
    ""
  ].join("\n");
}
function schemaOf(file) {
  const fs = file.header.find((h) => h.type === "FILE_SCHEMA")?.args[0];
  return Array.isArray(fs) && typeof fs[0] === "string" ? fs[0] : void 0;
}
function entitiesByType(file, type) {
  const t = type.toUpperCase();
  return file.entities.filter((e) => e.type === t);
}
const inverses = /* @__PURE__ */ new WeakMap();
function inverseIndex(file) {
  let inv = inverses.get(file);
  if (inv) return inv;
  inv = /* @__PURE__ */ new Map();
  const walk = (v, from, seen) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, from, seen));
    else if (isRef(v)) {
      if (seen.has(v.id)) return;
      seen.add(v.id);
      const list = inv.get(v.id);
      if (list) list.push(from);
      else inv.set(v.id, [from]);
    } else if (isObj(v) && v.kind === "typed") walk(v.value, from, seen);
  };
  for (const e of file.entities) {
    const seen = /* @__PURE__ */ new Set();
    for (const a of e.args) walk(a, e, seen);
    for (const p of e.complex ?? []) for (const a of p.args) walk(a, e, seen);
  }
  inverses.set(file, inv);
  return inv;
}
function deref(file, v) {
  return isRef(v) ? file.byId.get(v.id) : void 0;
}
const refsIn = (v) => Array.isArray(v) ? v.flatMap(refsIn) : isRef(v) ? [v.id] : [];
function referrers(file, id, type, index) {
  return (inverseIndex(file).get(id) ?? []).filter((r) => r.type === type && refsIn(r.args[index]).includes(id));
}
function unwrap(v) {
  if (v === void 0 || v === null) return null;
  if (typeof v === "string" || typeof v === "number") return v;
  if (Array.isArray(v)) return v.map(unwrap);
  switch (v.kind) {
    case "real":
      return v.value;
    case "enum":
      return v.value === "T" ? true : v.value === "F" ? false : v.value === "U" ? "UNKNOWN" : v.value;
    case "typed":
      return unwrap(v.value);
    case "ref":
      return { ref: v.id };
    case "binary":
      return v.value;
    case "derived":
      return null;
  }
}
const isTypeObject = (type) => type !== "IFCRELDEFINESBYTYPE" && (/TYPE$|^IFCTYPE/.test(type) || /^IFC(DOOR|WINDOW)STYLE$/.test(type));
function propertyValue(file, p) {
  const a = p.args;
  const measured = (v, unitAt) => {
    const out = { value: unwrap(v) };
    if (v != null && isObj(v) && v.kind === "typed") out.measure = v.type;
    const unit = deref(file, a[unitAt]);
    if (unit) out.unit = unit;
    return out;
  };
  switch (p.type) {
    case "IFCPROPERTYSINGLEVALUE":
      return measured(a[2], 3);
    case "IFCPROPERTYLISTVALUE":
    // Name, Specification, ListValues, Unit
    case "IFCPROPERTYENUMERATEDVALUE":
      return measured(a[2], p.type === "IFCPROPERTYLISTVALUE" ? 3 : -1);
    case "IFCPROPERTYBOUNDEDVALUE":
      return {
        value: { UpperBoundValue: unwrap(a[2]), LowerBoundValue: unwrap(a[3]), SetPointValue: unwrap(a[5]) },
        ...deref(file, a[4]) ? { unit: deref(file, a[4]) } : {}
      };
    case "IFCPROPERTYREFERENCEVALUE":
      return { value: unwrap(a[3]) };
    default:
      if (p.type.startsWith("IFCQUANTITY")) return measured(a[3], 2);
      return { value: unwrap(a[2]) };
  }
}
function definitionProps(file, def, detail) {
  const out = {};
  const list = def.type === "IFCELEMENTQUANTITY" ? def.args[5] : def.args[4];
  for (const id of refsIn(list)) {
    const p = file.byId.get(id);
    if (!p || typeof p.args[0] !== "string") continue;
    if (p.type === "IFCCOMPLEXPROPERTY") {
      out[p.args[0]] = definitionProps(file, { ...p, args: [null, null, null, null, p.args[3] ?? null] }, detail);
      continue;
    }
    const v = propertyValue(file, p);
    out[p.args[0]] = detail ? v : v.value;
  }
  return out;
}
function getPsets(file, entity, opts = {}) {
  const detail = opts.detail ?? false;
  const out = {};
  const add = (def) => {
    var _a;
    if (!def || typeof def.args[2] !== "string") return;
    Object.assign(out[_a = def.args[2]] ?? (out[_a] = {}), definitionProps(file, def, detail));
  };
  if (isTypeObject(entity.type)) {
    refsIn(entity.args[5]).forEach((id) => add(file.byId.get(id)));
    return out;
  }
  for (const rel of referrers(file, entity.id, "IFCRELDEFINESBYTYPE", 4)) {
    const type = deref(file, rel.args[5]);
    if (type) Object.assign(out, getPsets(file, type, opts));
  }
  for (const rel of referrers(file, entity.id, "IFCRELDEFINESBYPROPERTIES", 4)) {
    refsIn(rel.args[5]).forEach((id) => add(file.byId.get(id)));
  }
  return out;
}
function ports(file, element) {
  const out = [];
  for (const rel of referrers(file, element.id, "IFCRELNESTS", 4)) {
    for (const id of refsIn(rel.args[5])) {
      const p = file.byId.get(id);
      if (p?.type === "IFCDISTRIBUTIONPORT") out.push(p);
    }
  }
  for (const rel of referrers(file, element.id, "IFCRELCONNECTSPORTTOELEMENT", 5)) {
    const p = deref(file, rel.args[4]);
    if (p) out.push(p);
  }
  return out;
}
function connections(file) {
  return entitiesByType(file, "IFCRELCONNECTSPORTS").map((rel) => ({
    rel,
    relating: deref(file, rel.args[4]),
    related: deref(file, rel.args[5]),
    realizing: deref(file, rel.args[6])
  }));
}
export {
  DERIVED,
  connections,
  deref,
  encodeString,
  entitiesByType,
  enumv,
  formatReal,
  getPsets,
  inverseIndex,
  isRef,
  isTypeObject,
  parseStep,
  ports,
  real,
  ref,
  schemaOf,
  typed,
  unwrap,
  writeEntity,
  writeStep,
  writeValue
};
