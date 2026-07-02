#!/usr/bin/env bash
# Launch ShellQuest detached from this terminal. Symlink me into PATH:
#   ln -s "$(pwd)/tools/sq-launcher.sh" ~/.local/bin/sq
cd "$(dirname "$(readlink -f "$0")")/.." || exit 1
nohup npm start >/dev/null 2>&1 &
disown
echo "shellquest launching..."
