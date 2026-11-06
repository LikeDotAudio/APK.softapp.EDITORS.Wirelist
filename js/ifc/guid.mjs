// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// GENERATED — do not edit. The contracts GlobalId rule (uuid5 → 22-character IFC GlobalId), contracts/src/ifc/guid.ts,
// as plain ES module JS for a page with no build. Regenerate: node tests/fixtures/make_step_codec.mjs
const IFC_GUID_NAMESPACE = "6f1d3a52-7c0b-4b8e-9a51-6b8f0a7d3e11";
const IFC_GUID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
const IFC_GUID_RE = /^[0-3][0-9A-Za-z_$]{21}$/;
function sha1(bytes) {
  const ml = bytes.length;
  const words = ((ml + 8 >> 6) + 1) * 16;
  const w32 = new Uint32Array(words);
  for (let i = 0; i < ml; i++) w32[i >> 2] |= bytes[i] << 24 - i % 4 * 8;
  w32[ml >> 2] |= 128 << 24 - ml % 4 * 8;
  w32[words - 2] = Math.floor(ml * 8 / 4294967296);
  w32[words - 1] = ml * 8 >>> 0;
  let h0 = 1732584193, h1 = 4023233417, h2 = 2562383102, h3 = 271733878, h4 = 3285377520;
  const w = new Uint32Array(80);
  for (let off = 0; off < words; off += 16) {
    for (let t = 0; t < 16; t++) w[t] = w32[off + t];
    for (let t = 16; t < 80; t++) {
      const x = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
      w[t] = x << 1 | x >>> 31;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? b & c | ~b & d : t < 40 ? b ^ c ^ d : t < 60 ? b & c | b & d | c & d : b ^ c ^ d;
      const k = t < 20 ? 1518500249 : t < 40 ? 1859775393 : t < 60 ? 2400959708 : 3395469782;
      const tmp = (a << 5 | a >>> 27) + f + e + k + w[t] >>> 0;
      e = d;
      d = c;
      c = b << 30 | b >>> 2;
      b = a;
      a = tmp;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
  }
  const out = new Uint8Array(20);
  [h0, h1, h2, h3, h4].forEach((h, i) => {
    out[i * 4] = h >>> 24;
    out[i * 4 + 1] = h >>> 16 & 255;
    out[i * 4 + 2] = h >>> 8 & 255;
    out[i * 4 + 3] = h & 255;
  });
  return out;
}
function uuidBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error(`not a UUID: ${uuid}`);
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}
function uuid5Bytes(namespace, name) {
  const ns = uuidBytes(namespace);
  const nm = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns);
  buf.set(nm, ns.length);
  const h = sha1(buf).slice(0, 16);
  h[6] = h[6] & 15 | 80;
  h[8] = h[8] & 63 | 128;
  return h;
}
function compressGuid(bytes) {
  if (bytes.length !== 16) throw new Error("a GUID is 16 bytes");
  const A = IFC_GUID_ALPHABET;
  let out = A[bytes[0] >> 6] + A[bytes[0] & 63];
  for (let i = 1; i < 16; i += 3) {
    const n = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
    out += A[n >> 18 & 63] + A[n >> 12 & 63] + A[n >> 6 & 63] + A[n & 63];
  }
  return out;
}
function expandGuid(gid) {
  if (!IFC_GUID_RE.test(gid)) throw new Error(`not an IFC GlobalId: ${gid}`);
  const v = (c) => IFC_GUID_ALPHABET.indexOf(c);
  const b = [v(gid[0]) << 6 | v(gid[1])];
  for (let i = 2; i < 22; i += 4) {
    const n = v(gid[i]) << 18 | v(gid[i + 1]) << 12 | v(gid[i + 2]) << 6 | v(gid[i + 3]);
    b.push(n >> 16 & 255, n >> 8 & 255, n & 255);
  }
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function ifcGuid(...roles) {
  return compressGuid(uuid5Bytes(IFC_GUID_NAMESPACE, roles.join("/")));
}
export {
  IFC_GUID_ALPHABET,
  IFC_GUID_NAMESPACE,
  IFC_GUID_RE,
  compressGuid,
  expandGuid,
  ifcGuid,
  sha1,
  uuid5Bytes
};
