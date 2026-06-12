/**
 * pod.js — give an autonomous agent authenticated read/write on a Solid pod.
 *
 * Reads any resource (public GET) and writes it back signed with the agent's
 * own Nostr key via NIP-98 (kind 27235). No OAuth, no JWT, no passwords —
 * the key the agent already has IS its pod credential.
 *
 *   node pod.js get <url>
 *   node pod.js put <url>      # full body on stdin
 *
 * Key: $POD_NOSTR_KEY (32-byte hex) or the file at $POD_NOSTR_KEY_FILE.
 * Only the public key is ever sent; the private key never leaves this process.
 * Content-Type for writes defaults to application/ld+json ($POD_CONTENT_TYPE
 * to override).
 */

import { readFileSync } from 'node:fs';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

function loadKey() {
  if (process.env.POD_NOSTR_KEY) return process.env.POD_NOSTR_KEY.trim();
  if (process.env.POD_NOSTR_KEY_FILE) return readFileSync(process.env.POD_NOSTR_KEY_FILE, 'utf8').trim();
  throw new Error('no key: set POD_NOSTR_KEY (32-byte hex) or POD_NOSTR_KEY_FILE');
}

// NIP-01 event id: sha256 of the canonical [0, pubkey, created_at, kind, tags, content].
function eventId(ev) {
  const ser = JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]);
  return bytesToHex(sha256(utf8ToBytes(ser)));
}

// NIP-98 Authorization header for one request.
function authHeader(sk, pk, url, method) {
  const ev = {
    pubkey: pk, kind: 27235, created_at: Math.floor(Date.now() / 1000),
    tags: [['u', url], ['method', method]], content: '',
  };
  ev.id = eventId(ev);
  ev.sig = bytesToHex(schnorr.sign(ev.id, sk));
  return 'Nostr ' + Buffer.from(JSON.stringify(ev)).toString('base64');
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const [method, url] = process.argv.slice(2);
  if (!['get', 'put'].includes(method) || !url) {
    console.error('usage: pod.js <get|put> <url>   (put reads the full body from stdin)');
    process.exit(2);
  }
  const sk = loadKey();
  const pk = bytesToHex(schnorr.getPublicKey(sk));

  if (method === 'get') {
    const res = await fetch(url, { headers: { authorization: authHeader(sk, pk, url, 'GET') } });
    if (!res.ok) throw new Error(`GET ${res.status} ${res.statusText}`);
    process.stdout.write(await res.text());
    return;
  }

  // put
  const body = await readStdin();
  const contentType = process.env.POD_CONTENT_TYPE || 'application/ld+json';
  if (contentType.includes('json')) {
    try { JSON.parse(body); }
    catch { console.error('put: stdin is not valid JSON — nothing written'); process.exit(2); }
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: { authorization: authHeader(sk, pk, url, 'PUT'), 'content-type': contentType },
    body,
  });
  if (!res.ok) throw new Error(`PUT ${res.status} ${res.statusText}`);
  console.log('ok');
}

main().catch((e) => { console.error('pod error:', e.message); process.exit(1); });
