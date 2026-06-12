---
name: pod
description: Read and write resources on your Solid pod. Use to fetch a pod resource, or to change one — adds, edits, and deletes are all done by reading a resource and writing the edited version back.
tools: [Bash]
---
You can read and write resources on your Solid pod with the `pod` helper. Reads are public; writes are signed with your own key (NIP-98). Never invent a resource's contents — always GET it first, edit, then PUT the whole thing back.

**Read:**
```
node pod.js get <url>
```

**Write** (pipe the *complete* new body — not a fragment):
```
node pod.js put <url> <<'BODY'
{ ...the full edited document... }
BODY
```

Requires your key in the environment as `POD_NOSTR_KEY` (or `POD_NOSTR_KEY_FILE`). Any change — add, edit, complete, delete, reorder — is a get → modify → put. After `put` prints `ok`, confirm what you changed; if it errors, say so plainly rather than inventing a result.
