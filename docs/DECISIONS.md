# Design decisions (deviations & clarifications)

Where the build diverged from or extended the specs, and why. The specs are
kept verbatim in this folder; this file is the delta.

## v0.2

**Declarative lab setup (`setup` field).** The spec's challenge example
references planted files (`.secret` in a lab dir) but defines no planting
mechanism. Challenges may declare `"setup": { "dirs": [...], "files":
[{path, contents}] }` — pure data, materialized into
`~/shellquest-lab/<challenge-id>/` on first open (or on "reset lab"). Data,
never scripts, per the architecture's content-is-data rule.

**Dynamic flags.** The spec stores flags as SHA-256 hashes so the public
repo never contains answers — but a *planted* flag would still appear in
plaintext inside its `setup` data, defeating the hash. So planted flags are
dynamic: content carries a `{{FLAG}}` placeholder, the app generates a
random flag per materialization, and only its hash is stored, locally, in
`~/shellquest-lab/.verify/` (outside the repo, per-machine — consistent
with the machine-state principle). A `flag` check without `expected_sha256`
verifies against the generated hash. Static `expected_sha256` remains
supported for answers that are not planted (external wargames, knowledge
flags).

**Field naming.** The spec uses `expected_sha256` for flags but
`expect_sha256` for command-output; both are `expected_sha256` in the
implementation.

**Gating enforced in the main process,** not just hidden in the UI — a
locked exercise cannot be opened or run via IPC regardless of renderer
state.
