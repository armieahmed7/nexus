/**
 * F04 Credential Wallet: dependency-free crypto for Open Badges 3.0-shaped credentials. Import-free and synchronous, so the
 * pages (browser), the LocalBackend, the seed builder (node) and the unit tests share one implementation.
 *   - SHA-512 (FIPS 180-4) and SHA-256 over bytes
 *   - Ed25519 (RFC 8032) sign / verify / public key, cofactorless verification
 *   - canon(): JSON canonical form (sorted keys, no whitespace; the credential carries strings, arrays and objects only)
 *   - base64url, hex and base58btc helpers
 * The SQL mirror (kafaa_ed25519_sign, kafaa_jcs in supabase/migrations/20261009111001_kafaa_w1e1_passport.sql) signs the
 * same bytes; scripts/validate/w1e1-passport.mjs proves SQL signature = TS signature and the unit tests check RFC 8032 vectors.
 */

// ───────────── bytes
export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export function fromHex(h: string): Uint8Array {
  const s = h.trim().toLowerCase();
  if (s.length % 2 || /[^0-9a-f]/.test(s)) throw new Error('bad hex');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function b64url(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '') + (i + 2 < b.length ? B64[n & 63] : '');
  }
  return out;
}
export function fromB64url(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  if (/[^A-Za-z0-9_-]/.test(clean) || clean.length % 4 === 1) throw new Error('bad base64url');
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of clean) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
  }
  return Uint8Array.from(out);
}
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58btc(b: Uint8Array): string {
  let n = 0n;
  for (const x of b) n = n * 256n + BigInt(x);
  let s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const x of b) { if (x !== 0) break; s = '1' + s; }
  return s;
}

// ───────────── SHA-512 / SHA-256
const M64 = (1n << 64n) - 1n;
const K512 = [
  '428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc', '3956c25bf348b538', '59f111f1b605d019', '923f82a4af194f9b', 'ab1c5ed5da6d8118',
  'd807aa98a3030242', '12835b0145706fbe', '243185be4ee4b28c', '550c7dc3d5ffb4e2', '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235', 'c19bf174cf692694',
  'e49b69c19ef14ad2', 'efbe4786384f25e3', '0fc19dc68b8cd5b5', '240ca1cc77ac9c65', '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5',
  '983e5152ee66dfab', 'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4', 'c6e00bf33da88fc2', 'd5a79147930aa725', '06ca6351e003826f', '142929670a0e6e70',
  '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed', '53380d139d95b3df', '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b',
  'a2bfe8a14cf10364', 'a81a664bbc423001', 'c24b8b70d0f89791', 'c76c51a30654be30', 'd192e819d6ef5218', 'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8',
  '19a4c116b8d2d0c8', '1e376c085141ab53', '2748774cdf8eeb99', '34b0bcb5e19b48a8', '391c0cb3c5c95a63', '4ed8aa4ae3418acb', '5b9cca4f7763e373', '682e6ff3d6b2b8a3',
  '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec', '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b',
  'ca273eceea26619c', 'd186b8c721c0c207', 'eada7dd6cde0eb1e', 'f57d4f7fee6ed178', '06f067aa72176fba', '0a637dc5a2c898a6', '113f9804bef90dae', '1b710b35131c471b',
  '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc', '431d67c49c100d4c', '4cc5d4becb3e42b6', '597f299cfc657e2a', '5fcb6fab3ad6faec', '6c44198c4a475817',
].map((h) => BigInt(`0x${h}`));
const H512 = ['6a09e667f3bcc908', 'bb67ae8584caa73b', '3c6ef372fe94f82b', 'a54ff53a5f1d36f1', '510e527fade682d1', '9b05688c2b3e6c1f', '1f83d9abfb41bd6b', '5be0cd19137e2179'].map((h) => BigInt(`0x${h}`));
const rotr64 = (x: bigint, n: bigint) => ((x >> n) | (x << (64n - n))) & M64;

export function sha512(msg: Uint8Array): Uint8Array {
  const len = msg.length;
  const padLen = (len + 17 + 127) & ~127;
  const m = new Uint8Array(padLen);
  m.set(msg);
  m[len] = 0x80;
  const bitLen = BigInt(len) * 8n;
  for (let i = 0; i < 16; i++) m[padLen - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 255n);
  const h = [...H512];
  const w = new Array<bigint>(80);
  for (let off = 0; off < padLen; off += 128) {
    for (let i = 0; i < 16; i++) {
      let v = 0n;
      for (let j = 0; j < 8; j++) v = (v << 8n) | BigInt(m[off + i * 8 + j]);
      w[i] = v;
    }
    for (let i = 16; i < 80; i++) {
      const s0 = rotr64(w[i - 15], 1n) ^ rotr64(w[i - 15], 8n) ^ (w[i - 15] >> 7n);
      const s1 = rotr64(w[i - 2], 19n) ^ rotr64(w[i - 2], 61n) ^ (w[i - 2] >> 6n);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & M64;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 80; i++) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ (~e & M64 & g);
      const t1 = (hh + S1 + ch + K512[i] + w[i]) & M64;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) & M64;
      hh = g; g = f; f = e; e = (d + t1) & M64; d = c; c = b; b = a; a = (t1 + t2) & M64;
    }
    h[0] = (h[0] + a) & M64; h[1] = (h[1] + b) & M64; h[2] = (h[2] + c) & M64; h[3] = (h[3] + d) & M64;
    h[4] = (h[4] + e) & M64; h[5] = (h[5] + f) & M64; h[6] = (h[6] + g) & M64; h[7] = (h[7] + hh) & M64;
  }
  const out = new Uint8Array(64);
  h.forEach((v, i) => { for (let j = 0; j < 8; j++) out[i * 8 + j] = Number((v >> BigInt(56 - 8 * j)) & 255n); });
  return out;
}

const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
export function sha256(msg: Uint8Array): Uint8Array {
  const len = msg.length;
  const padLen = (len + 9 + 63) & ~63;
  const m = new Uint8Array(padLen);
  m.set(msg);
  m[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(padLen - 4, bits >>> 0);
  dv.setUint32(padLen - 8, Math.floor(bits / 2 ** 32));
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const r = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  h.forEach((v, i) => ov.setUint32(i * 4, v >>> 0));
  return out;
}

// ───────────── Ed25519 (RFC 8032), extended coordinates
const P = (1n << 255n) - 19n;
export const ED_L = (1n << 252n) + 27742317777372353535851937790883648493n;
const mod = (a: bigint, m: bigint = P) => ((a % m) + m) % m;
function pow(b: bigint, e: bigint, m: bigint = P): bigint {
  let r = 1n;
  b = mod(b, m);
  while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; }
  return r;
}
const inv = (a: bigint) => pow(a, P - 2n);
const D = mod(-121665n * inv(121666n));
const D2 = mod(2n * D);
const SQRT_M1 = pow(2n, (P - 1n) / 4n);
type Pt = [bigint, bigint, bigint, bigint];
const ZERO: Pt = [0n, 1n, 1n, 0n];
function add(p: Pt, q: Pt): Pt {
  const A = mod((p[1] - p[0]) * (q[1] - q[0]));
  const B = mod((p[1] + p[0]) * (q[1] + q[0]));
  const C = mod(p[3] * D2 * q[3]);
  const Dd = mod(p[2] * 2n * q[2]);
  const E = B - A, F = Dd - C, G = Dd + C, H = B + A;
  return [mod(E * F), mod(G * H), mod(F * G), mod(E * H)];
}
function dbl(p: Pt): Pt {
  const A = mod(p[0] * p[0]);
  const B = mod(p[1] * p[1]);
  const C = mod(2n * p[2] * p[2]);
  const H = A + B;
  const E = H - mod((p[0] + p[1]) * (p[0] + p[1]));
  const G = A - B;
  const F = C + G;
  return [mod(E * F), mod(G * H), mod(F * G), mod(E * H)];
}
function mul(k: bigint, p: Pt): Pt {
  let q = ZERO;
  for (let i = BigInt(k.toString(2).length - 1); i >= 0n; i--) {
    q = dbl(q);
    if ((k >> i) & 1n) q = add(q, p);
  }
  return q;
}
function recoverX(y: bigint, sign: number): bigint | null {
  if (y >= P) return null;
  const u = mod(y * y - 1n);
  const v = mod(D * y * y + 1n);
  let x = mod(u * pow(v, 3n) * pow(mod(u * pow(v, 7n)), (P - 5n) / 8n));
  const vx2 = mod(v * x * x);
  if (vx2 === u) { /* ok */ } else if (vx2 === mod(-u)) x = mod(x * SQRT_M1);
  else return null;
  if (x === 0n && sign === 1) return null;
  if (Number(x & 1n) !== sign) x = P - x;
  return x;
}
const BY = mod(4n * inv(5n));
const BASE: Pt = (() => { const x = recoverX(BY, 0)!; return [x, BY, 1n, mod(x * BY)]; })();
const leInt = (b: Uint8Array) => { let n = 0n; for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]); return n; };
const le32 = (n: bigint) => { const out = new Uint8Array(32); for (let i = 0; i < 32; i++) { out[i] = Number(n & 255n); n >>= 8n; } return out; };
function encode(p: Pt): Uint8Array {
  const zi = inv(p[2]);
  const x = mod(p[0] * zi), y = mod(p[1] * zi);
  const out = le32(y);
  if (x & 1n) out[31] |= 0x80;
  return out;
}
function decode(b: Uint8Array): Pt | null {
  if (b.length !== 32) return null;
  const c = b.slice();
  const sign = c[31] >> 7;
  c[31] &= 0x7f;
  const y = leInt(c);
  const x = recoverX(y, sign);
  return x == null ? null : [x, y, 1n, mod(x * y)];
}
function expand(seed: Uint8Array) {
  if (seed.length !== 32) throw new Error('Ed25519 seed must be 32 bytes');
  const h = sha512(seed);
  const a = h.slice(0, 32);
  a[0] &= 248; a[31] &= 127; a[31] |= 64;
  return { a: leInt(a), prefix: h.slice(32) };
}
export function edPublicKey(seed: Uint8Array): Uint8Array {
  return encode(mul(expand(seed).a, BASE));
}
export function edSign(msg: Uint8Array, seed: Uint8Array): Uint8Array {
  const { a, prefix } = expand(seed);
  const A = encode(mul(a, BASE));
  const r = mod(leInt(sha512(concat(prefix, msg))), ED_L);
  const R = encode(mul(r, BASE));
  const k = mod(leInt(sha512(concat(R, A, msg))), ED_L);
  return concat(R, le32(mod(r + k * a, ED_L)));
}
export function edVerify(sig: Uint8Array, msg: Uint8Array, pub: Uint8Array): boolean {
  if (sig.length !== 64 || pub.length !== 32) return false;
  const A = decode(pub);
  const R = decode(sig.slice(0, 32));
  const S = leInt(sig.slice(32));
  if (!A || !R || S >= ED_L) return false;
  const k = mod(leInt(sha512(concat(sig.slice(0, 32), pub, msg))), ED_L);
  const lhs = encode(mul(S, BASE));
  const rhs = encode(add(R, mul(k, A)));
  return toHex(lhs) === toHex(rhs);
}

// ───────────── canonical JSON (the subset the credentials use: objects, arrays, strings, booleans, null)
export function canon(v: unknown): string {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isInteger(v)) throw new Error('canon: only integer numbers are supported');
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`;
}
