# Migration runbook — moving ShellQuest to a new machine

The repo is the save file. Moving machines is a clone, not a restore.

## The steps

```bash
# 1. Get the repo (needs git + an SSH key added to GitHub)
git clone git@github.com:tylerleonarddev/ShellQuest.git shellquest
cd shellquest

# 2. Install & run (needs Node 18+ and Python 3 on PATH)
npm install
npm start
```

That's the whole migration. Then, per machine:

```bash
# 3. Git identity for the auto-commits (once per machine)
git config user.name  "Ty Leonard"
git config user.email "tjleon1262@gmail.com"

# 4. Optional launchers
ln -s "$PWD/tools/sq-launcher.sh" ~/.local/bin/sq   # or copy the sq script
# desktop entry: see README "Launching"
```

## What comes across, and what doesn't

- **Comes across untouched (it's in git):** every exercise, your XP, level,
  streak history, completions, review schedules, weekly goals, published
  devlogs. Nothing about *you* is lost.
- **Rebuilt from reality on the new box (never synced as truth):**
  - `~/shellquest-lab/` — challenge labs re-materialize on first open, with
    fresh dynamic flags (`~/shellquest-lab/.verify/` is per-machine).
  - `machine-state/` — reserved for v2 system-state checks; re-checked per
    hostname, per ARCHITECTURE.md §5.
  - `node_modules/`, the editor bundle — rebuilt by `npm install` / prestart.

## Ubuntu 24.04+ gotcha (AppArmor vs Electron)

If `npm start` dies with a `SUID sandbox helper` error, the kernel is
restricting unprivileged user namespaces. Fix it properly (no --no-sandbox)
with a per-binary AppArmor profile:

```bash
sudo tee /etc/apparmor.d/electron-shellquest >/dev/null <<'EOF'
abi <abi/5.0>,
include <tunables/global>

profile electron-shellquest /ABSOLUTE/PATH/TO/shellquest/node_modules/electron/dist/electron flags=(unconfined) {
  userns,
  include if exists <local/electron-shellquest>
}
EOF
sudo apparmor_parser -r /etc/apparmor.d/electron-shellquest
```

(Adjust the binary path; re-run `apparmor_parser` if the repo moves.)

## Sanity check after migrating

1. Dashboard shows your XP/level/streak exactly as before.
2. Open a terminal challenge → a fresh lab appears under `~/shellquest-lab/`.
3. Pass anything → a commit lands → `git push` works.
