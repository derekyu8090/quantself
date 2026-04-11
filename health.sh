#!/bin/bash
# QuantSelf Health Dashboard — quick launcher
# Usage: health (after adding alias to .zshrc)

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=5173

# Kill any existing servers on common ports
for p in 5173 5174 5175 5180; do
  lsof -ti:$p 2>/dev/null | xargs kill -9 2>/dev/null
done

# Start chat server in background
cd "$DIR"
/Users/user/opt/anaconda3/bin/python3 "$DIR/chat_server.py" &>/dev/null &
CHAT_PID=$!

# Start dev server in background
npm run dev -- --port $PORT --host &>/dev/null &
DEV_PID=$!

# Wait for server to be ready
echo "Starting QuantSelf dashboard..."
for i in $(seq 1 20); do
  if curl -s http://localhost:$PORT >/dev/null 2>&1; then
    break
  fi
  sleep 0.3
done

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "unknown")

# Open in default browser
open "http://localhost:$PORT"
echo "Dashboard running"
echo "  Local:   http://localhost:$PORT"
echo "  Mobile:  http://$LOCAL_IP:$PORT"
echo "  Chat:    http://localhost:5180 (PID: $CHAT_PID)"
echo "  Vite:    PID $DEV_PID"
echo "Press Ctrl+C or run 'kill $DEV_PID $CHAT_PID' to stop"
