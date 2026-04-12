#!/usr/bin/env python3
"""
QuantSelf Chat Server — Natural language health data Q&A
Runs on localhost:5180 and proxies queries to the configured LLM provider.

Usage:
    python3 chat_server.py              # starts on port 5180
    python3 chat_server.py --port 5181  # custom port
"""

import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

# Import from process_data
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_data import call_llm, CONFIG

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'data')


def get_active_profile():
    """Read active profile from profiles.json, fallback to 'default'."""
    reg_path = os.path.join(DATA_DIR, 'profiles.json')
    if os.path.exists(reg_path):
        try:
            with open(reg_path) as f:
                return json.load(f).get('active', 'default')
        except Exception:
            pass
    return 'default'


def load_health_context():
    """Load a compact summary of health data for LLM context (from active profile)."""
    profile = get_active_profile()
    profile_dir = os.path.join(DATA_DIR, 'profiles', profile)
    ctx = {'_profile': profile}
    for fname in ['overview.json', 'cardiovascular.json', 'sleep.json', 'activity.json']:
        fpath = os.path.join(profile_dir, fname)
        if not os.path.exists(fpath):
            fpath = os.path.join(DATA_DIR, fname)  # legacy fallback
        if os.path.exists(fpath):
            with open(fpath) as f:
                data = json.load(f)
            # Keep only summary stats to stay within context limits
            if fname == 'overview.json':
                ctx['healthScore'] = data.get('healthScore', {}).get('latest')
                ctx['healthTrend'] = data.get('healthScore', {}).get('trend')
                ctx['longevityScore'] = data.get('longevityScore', {}).get('score')
                ctx['longevityComponents'] = {
                    k: v.get('score') for k, v in data.get('longevityScore', {}).get('components', {}).items()
                }
                ctx['risks'] = {k: {'score': v['score'], 'level': v['level']}
                                for k, v in data.get('risks', {}).items()}
                ctx['baselines'] = data.get('baselines', {})
                ctx['trends'] = data.get('trends', [])
                ctx['hrCycles'] = {
                    'avgCycleLength': data.get('hrCycles', {}).get('avgCycleLength'),
                    'recommendation': data.get('hrCycles', {}).get('recommendation'),
                }
                ctx['user'] = data.get('user', {})
            elif fname == 'cardiovascular.json':
                ctx['rhrStats'] = data.get('rhr', {}).get('stats', {})
                ctx['hrvStats'] = data.get('hrv', {}).get('stats', {})
                ctx['vo2Stats'] = data.get('vo2max', {}).get('stats', {})
                ctx['spo2Stats'] = data.get('spo2', {}).get('stats', {})
            elif fname == 'sleep.json':
                ctx['sleepStats'] = data.get('stats', {})
                last_nights = data.get('nightly', [])[-7:]
                ctx['recentSleep'] = [{'date': n['date'], 'total': n['total'],
                                       'deep': n.get('deep', 0), 'bedtime': n.get('bedtime')}
                                      for n in last_nights]
            elif fname == 'activity.json':
                ctx['stepsStats'] = data.get('steps', {}).get('stats', {})
                ctx['recentWorkouts'] = [
                    {'date': w.get('date'), 'type': w.get('type'), 'duration': w.get('duration')}
                    for w in (data.get('workouts', [])[-5:])
                ]
    return ctx


SYSTEM_PROMPT = """You are a personal health data analyst for the QuantSelf dashboard.
You have access to the user's health metrics summary below. Answer questions concisely
and provide evidence-based advice. Always respond in the same language the user writes in.
If asked about data you don't have, say so honestly.

Current health data:
{context}
"""


class ChatHandler(BaseHTTPRequestHandler):
    health_context = None

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_DELETE(self):
        # Delete a profile directory
        if self.path.startswith('/api/profile/'):
            profile = self.path[len('/api/profile/'):]
            if profile == 'default':
                self._json_response({'error': 'Cannot delete default profile'}, 403)
                return
            profile_dir = os.path.join(DATA_DIR, 'profiles', profile)
            registry_path = os.path.join(DATA_DIR, 'profiles.json')
            try:
                if os.path.isdir(profile_dir):
                    import shutil
                    shutil.rmtree(profile_dir)
                # Update registry
                if os.path.exists(registry_path):
                    with open(registry_path) as f:
                        registry = json.load(f)
                    registry['profiles'] = [p for p in registry.get('profiles', []) if p.get('name') != profile]
                    if registry.get('active') == profile:
                        registry['active'] = 'default'
                    with open(registry_path, 'w') as f:
                        json.dump(registry, f, indent=2)
                # Clear cached health context so next chat reloads
                ChatHandler.health_context = None
                self._json_response({'status': 'deleted', 'profile': profile})
            except Exception as e:
                self._json_response({'error': str(e)}, 500)
            return
        self.send_error(404)

    def do_GET(self):
        if self.path == '/api/health':
            self._json_response({'status': 'ok', 'provider': CONFIG.get('llm', {}).get('provider', 'claude')})
            return
        # Root path — show a simple status page
        html = f"""<!DOCTYPE html>
<html><head><title>QuantSelf Chat Server</title>
<style>
body{{font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:60px auto;padding:20px;color:#2c3e50}}
h1{{color:#3498db;margin-bottom:8px}}
.status{{display:inline-block;padding:4px 12px;background:#2ecc71;color:#fff;border-radius:12px;font-size:12px;font-weight:600}}
code{{background:#ecf0f1;padding:2px 8px;border-radius:4px;font-size:13px}}
.note{{background:#fff9c4;padding:12px 16px;border-left:3px solid #f39c12;margin-top:20px;border-radius:4px;font-size:13px}}
</style></head><body>
<h1>QuantSelf Chat Server</h1>
<p><span class="status">RUNNING</span></p>
<p>LLM provider: <code>{CONFIG.get('llm', {}).get('provider', 'claude')}</code></p>
<p>Endpoint: <code>POST /api/chat</code></p>
<p>Health check: <code>GET /api/health</code></p>
<div class="note">
  This is a backend API server, not a chat UI.
  Open the dashboard and click the chat bubble at the bottom right to talk to your health data.
</div>
</body></html>"""
        self.send_response(200)
        self._cors_headers()
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def do_POST(self):
        if self.path != '/api/chat':
            self.send_error(404)
            return

        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        question = body.get('message', '').strip()

        if not question:
            self._json_response({'error': 'Empty message'}, 400)
            return

        # Reload context each request — profile may have changed
        ChatHandler.health_context = load_health_context()

        ctx_str = json.dumps(ChatHandler.health_context, ensure_ascii=False, indent=1)
        full_prompt = SYSTEM_PROMPT.format(context=ctx_str) + '\n\nUser question: ' + question

        try:
            answer = call_llm(full_prompt, CONFIG)
            self._json_response({'answer': answer})
        except Exception as e:
            self._json_response({'error': str(e)}, 500)

    def _json_response(self, data, status=200):
        self.send_response(status)
        self._cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        print(f"  [chat] {args[0]}" if args else "")


def main():
    import argparse
    parser = argparse.ArgumentParser(description='QuantSelf Chat Server')
    parser.add_argument('--port', type=int, default=5180)
    args = parser.parse_args()

    server = HTTPServer(('0.0.0.0', args.port), ChatHandler)
    print(f"QuantSelf Chat Server running on http://localhost:{args.port}")
    print(f"  LLM provider: {CONFIG.get('llm', {}).get('provider', 'claude')}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nChat server stopped.")


if __name__ == '__main__':
    main()
