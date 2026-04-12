#!/bin/bash
# QuantSelf Share — Deploy a single profile via Cloudflare Tunnel
#
# Usage:
#   ./share.sh <profile-name>
#   ./share.sh friend
#
# What it does:
# 1. Builds the React app with SHARE_MODE enabled
# 2. Creates an isolated dist directory with ONLY the specified profile's data
# 3. Starts a Python HTTP server to serve the isolated directory
# 4. Starts a Cloudflare tunnel and prints the public URL

set -e

PROFILE="${1:-}"
if [ -z "$PROFILE" ]; then
  echo "Usage: ./share.sh <profile-name>"
  echo "Example: ./share.sh friend"
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
SHARE_DIR="/tmp/quantself-share-$PROFILE"
PORT=8765

# Check profile exists
if [ ! -d "$DIR/public/data/profiles/$PROFILE" ]; then
  echo "ERROR: Profile '$PROFILE' not found at public/data/profiles/$PROFILE"
  echo "Available profiles:"
  ls "$DIR/public/data/profiles/" 2>/dev/null
  exit 1
fi

echo "[1/5] Building React app..."
cd "$DIR"
npm run build &>/dev/null

echo "[2/5] Preparing isolated share directory at $SHARE_DIR..."
rm -rf "$SHARE_DIR"
mkdir -p "$SHARE_DIR"

# Copy the built frontend
cp -r "$DIR/dist/." "$SHARE_DIR/"

# CRITICAL: wipe any data that vite copied from public/ — we only want the chosen profile
rm -rf "$SHARE_DIR/data"
mkdir -p "$SHARE_DIR/data/profiles/$PROFILE"

# Enable SHARE_MODE in index.html so no URL param is needed
python3 -c "
with open('$SHARE_DIR/index.html') as f:
    html = f.read()
script = '<script>window.__QUANTSELF_SHARE_MODE__ = true;</script>'
html = html.replace('</head>', script + '</head>')
with open('$SHARE_DIR/index.html', 'w') as f:
    f.write(html)
"

# Copy ONLY the specified profile's data (default and other profiles excluded)
cp "$DIR/public/data/profiles/$PROFILE/"*.json "$SHARE_DIR/data/profiles/$PROFILE/"

# Create a minimal profiles.json with only this profile
python3 -c "
import json
src = json.load(open('$DIR/public/data/profiles.json'))
target = [p for p in src['profiles'] if p['name'] == '$PROFILE']
if not target:
    print('ERROR: Profile \"$PROFILE\" not in profiles.json')
    exit(1)
out = {'active': '$PROFILE', 'profiles': target}
json.dump(out, open('$SHARE_DIR/data/profiles.json', 'w'), indent=2)
"

# Verify isolation: only our profile should exist
ACTUAL=$(ls "$SHARE_DIR/data/profiles/" | tr '\n' ' ')
echo "[3/5] Share directory contents: $ACTUAL"
if [ "$ACTUAL" != "$PROFILE " ]; then
  echo "ERROR: Share directory contains unexpected profiles: $ACTUAL"
  echo "Expected: $PROFILE only"
  rm -rf "$SHARE_DIR"
  exit 1
fi
echo ""

# Kill any existing server on the port
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null

echo "[4/5] Starting local HTTP server on port $PORT..."
cd "$SHARE_DIR"
python3 -m http.server $PORT &>/dev/null &
HTTP_PID=$!
sleep 1

# Verify server is up
if ! curl -s "http://localhost:$PORT/" >/dev/null 2>&1; then
  echo "ERROR: HTTP server failed to start"
  kill $HTTP_PID 2>/dev/null
  exit 1
fi

echo "[5/5] Starting Cloudflare tunnel..."
echo ""
echo "─────────────────────────────────────────────────"
echo "Share setup complete."
echo "  Profile:  $PROFILE"
echo "  Local:    http://localhost:$PORT"
echo "  HTTP PID: $HTTP_PID"
echo ""
echo "Cloudflare will print the public URL below."
echo "Press Ctrl+C to stop (this will kill both the tunnel and HTTP server)."
echo "─────────────────────────────────────────────────"
echo ""

# Trap to clean up on exit
trap "kill $HTTP_PID 2>/dev/null; rm -rf '$SHARE_DIR' 2>/dev/null; echo '; cleanup done'" EXIT INT TERM

cloudflared tunnel --url "http://localhost:$PORT"
