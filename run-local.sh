#!/bin/zsh
# Loads the JWT from .env and runs the streak script. Called by launchd.
cd "$(dirname "$0")" || exit 1
set -a
source ./.env
set +a
exec /opt/homebrew/bin/node streak.js
