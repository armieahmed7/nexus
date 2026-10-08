/** F04 Credential Wallet: Ed25519 / SHA-512 / canonical JSON, the issuer document and the tamper acceptance. */
import { describe, expect, it } from 'vitest';
import { createHash, createPrivateKey, sign as nodeSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { b64url, canon, edPublicKey, edSign, edVerify, fromB64url, fromHex, sha256, sha512, toHex, utf8, base58btc } from '../../src/modules/m17/badgeCrypto';
import { buildCredential, issuerDocument, signingBytes, verifyCredential, withProof } from '../../src/modules/m17/issuer';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
// RFC 8032 section 7.1, tests 1-3
const RFC = [
  ['9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a', '', 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b'],
  ['4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb', '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c', '72', '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00'],
  ['c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7', 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025', 'af82', '6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a'],
];
const nodeKey = (seedHex: string) => createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(seedHex, 'hex')]), format: 'der', type: 'pkcs8' });

describe('F04 crypto (badgeCrypto.ts)', () => {
  it('Ed25519 matches the RFC 8032 test vectors', () => {
    for (const [sk, pk, msg, sig] of RFC) {
      expect(toHex(edPublicKey(fromHex(sk)))).toBe(pk);
      expect(toHex(edSign(fromHex(msg), fromHex(sk)))).toBe(sig);
      expect(edVerify(fromHex(sig), fromHex(msg), fromHex(pk))).toBe(true);
    }
  });
  it('signatures equal node:crypto Ed25519 and a flipped bit fails verification', () => {
    const sk = RFC[1][0];
    for (const m of ['', 'كفاءة', 'x'.repeat(300), JSON.stringify(T.badges[0].credential)]) {
      const s = edSign(utf8(m), fromHex(sk));
      expect(toHex(s)).toBe(nodeSign(null, Buffer.from(utf8(m)), nodeKey(sk)).toString('hex'));
      const bad = utf8(m + '!');
      expect(edVerify(s, bad, edPublicKey(fromHex(sk)))).toBe(false);
    }
  });
  it('SHA-512, SHA-256, base64url and base58 agree with node', () => {
    for (const m of ['', 'abc', 'a'.repeat(111), 'a'.repeat(112), 'a'.repeat(1000), 'كفاءة']) {
      expect(toHex(sha512(utf8(m)))).toBe(createHash('sha512').update(m).digest('hex'));
      expect(toHex(sha256(utf8(m)))).toBe(createHash('sha256').update(m).digest('hex'));
      expect(b64url(utf8(m))).toBe(Buffer.from(m).toString('base64url'));
      expect(toHex(fromB64url(b64url(utf8(m))))).toBe(Buffer.from(m).toString('hex'));
    }
    expect(base58btc(Uint8Array.from([0, 0, 1]))).toBe('112');
  });
  it('canon() sorts keys, drops undefined and keeps array order', () => {
    expect(canon({ b: 1, a: [3, { d: 'x', c: null }], u: undefined })).toBe('{"a":[3,{"c":null,"d":"x"}],"b":1}');
  });
});

describe('F04 issuer and credentials', () => {
  it('the published issuer document equals issuerDocument() (public/.well-known/kafaa-issuer.json)', () => {
    expect(JSON.parse(readFileSync('public/.well-known/kafaa-issuer.json', 'utf8'))).toEqual(issuerDocument());
  });
  it('every seeded badge verifies with the server key (key-1)', () => {
    expect(T.badges.length).toBeGreaterThan(20);
    for (const b of T.badges) expect(verifyCredential(b.credential), b.id).toEqual({ outcome: 'valid', keyId: 'key-1', slug: b.public_slug });
  });
  it('tampering with any field of a downloaded badge makes the signature invalid', () => {
    const cred = T.badges.find((b) => b.person_id === 'p-k-ro').credential;
    const paths: (string | number)[][] = [];
    const walk = (v: unknown, p: (string | number)[]) => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...p, i]));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, [...p, k]);
      else paths.push(p);
    };
    walk(cred, []);
    expect(paths.length).toBeGreaterThan(30);
    for (const p of paths) {
      if (p.join('.') === 'proof.proofValue') continue;
      const copy = JSON.parse(JSON.stringify(cred));
      let o = copy;
      for (const k of p.slice(0, -1)) o = o[k];
      o[p[p.length - 1]] = `${String(o[p[p.length - 1]])}x`;
      expect(verifyCredential(copy).outcome, p.join('.')).not.toBe('valid');
    }
    const extra = { ...JSON.parse(JSON.stringify(cred)), extraField: 'added' };
    expect(verifyCredential(extra).outcome).toBe('invalid_signature');
    const forged = JSON.parse(JSON.stringify(cred));
    forged.proof.proofValue = `u${b64url(edSign(signingBytes(forged), fromHex(RFC[0][0])))}`;
    expect(verifyCredential(forged).outcome).toBe('invalid_signature');
    expect(verifyCredential({ ...cred, proof: { ...cred.proof, verificationMethod: 'urn:x#k' } }).outcome).toBe('unknown_key');
    expect(verifyCredential('nope').outcome).toBe('malformed');
    expect(verifyCredential({ id: 'x' }).outcome).toBe('malformed');
  });
  it('a credential signed with the offline key verifies as key-offline', () => {
    const cred = buildCredential({ slug: 'kbtest', kind: 'completion', certificateNo: null, course: { id: 'c-scwe', code: 'SC-1', title_en: 'Safety culture', title_ar: 'ثقافة السلامة' }, holderInitials: 'RO', issuedOn: '2026-10-08', validTo: null, sourceDate: '2026-05-15', sourceSystem: 'Training records system', alignment: [], keyId: 'key-offline' });
    const signed = withProof(cred, edSign(signingBytes(cred), fromHex('80df5566f0f615286d25a424ee54b2c33e94253912786453b748dd943143864d')));
    expect(verifyCredential(signed)).toEqual({ outcome: 'valid', keyId: 'key-offline', slug: 'kbtest' });
    expect(signed.validUntil).toBeUndefined();
  });
});
