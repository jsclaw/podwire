# podwire

> Wire an autonomous agent to a [Solid](https://solidproject.org) pod — authenticated read/write with the agent's **own key**, no OAuth and no passwords.

An agent that has a Nostr key already has everything it needs to read and write
its pod. `podwire` is a tiny skill — one helper (`pod.js`) and a `SKILL.md` —
plus this guide to wiring it up.

The whole capability is two primitives:

```
node pod.js get <url>      # read any resource (public GET)
node pod.js put <url>      # write the full body back, signed (NIP-98)
```

Two primitives plus the agent's own reasoning give it full CRUD over its pod
data — add, edit, complete, delete — with **no per-verb endpoints**. To change
anything: `get` the resource, edit the document, `put` it back.

## Wiring an agent to a pod

1. **Give the agent a Nostr key** (a 32-byte hex secret). The private key stays
   in the agent's environment as `POD_NOSTR_KEY` (or a file via
   `POD_NOSTR_KEY_FILE`) and is never published. Only the public key travels.

2. **Publish the public key in a WebID profile** as a
   [CID](https://www.w3.org/TR/cid-1.0/) `verificationMethod`, referenced from
   `authentication`. That's how the pod resolves a signing key back to the
   agent's WebID. The Multikey form is:

   ```
   publicKeyMultibase = "f" + "e701" + "02" + <x-only-pubkey-hex>
   ```

   (`f` = base16 multibase, `e701` = the secp256k1-pub multicodec, `02` = the
   even-y BIP-340 parity.)

3. **For a resource the agent doesn't own** (someone else's pod), add a
   [WAC](https://solid.github.io/web-access-control-spec/) `.acl` granting the
   agent write access. When the signing key isn't in *that* pod's owner profile,
   the server authenticates the request as `did:nostr:<pubkey>`, so grant that:

   ```json
   {
     "@context": { "acl": "http://www.w3.org/ns/auth/acl#" },
     "@graph": [{
       "@id": "#agent",
       "@type": "acl:Authorization",
       "acl:agent": { "@id": "did:nostr:<pubkey-hex>" },
       "acl:accessTo": { "@id": "./the-resource.jsonld" },
       "acl:mode": [ { "@id": "acl:Read" }, { "@id": "acl:Write" } ]
     }]
   }
   ```

   On the agent's **own** pod, ordinary owner access already covers writes — no
   grant needed.

4. **Use it.** Wire `SKILL.md` into your agent so it knows the helper exists,
   set `POD_NOSTR_KEY`, and it can read and edit pod resources on request.

## How writes are authenticated (NIP-98)

Each write carries an `Authorization: Nostr <base64-event>` header. The event is
a Nostr [NIP-98](https://nips.nostr.com/98) kind-`27235` event with `u` (the
URL) and `method` tags, Schnorr-signed by the agent's key. The pod verifies the
signature and maps the pubkey to an identity (a WebID via the published
verificationMethod, else `did:nostr:<pubkey>`), then checks access control as
usual.

## Install

```
npm install            # @noble/curves, @noble/hashes
export POD_NOSTR_KEY=<32-byte-hex>
node pod.js get https://your.pod/public/tracker/todo-data.jsonld
```

## Notes

- **Don't send a `payload` tag** for bodies the server re-serializes (e.g.
  JSON-LD): the hash of your exact bytes won't match the re-serialized body.
  Omitting it is fine — the signature still binds URL + method + freshness.
- A resource `.acl` **overrides** the inherited container default for that
  resource, so restate the owner's and public's access alongside the new grant.
- Background on the server side and a few pod papercuts:
  [jspod#79](https://github.com/JavaScriptSolidServer/jspod/issues/79).

## License

[AGPL-3.0-or-later](./LICENSE).
