#!/usr/bin/env python3
"""
Bundle the built React app + a single profile's data into ONE self-contained HTML file.
Designed for sharing via WeChat/email to someone who can't access the dev server.

Usage:
    python3 bundle_standalone.py <profile> [output.html]
    python3 bundle_standalone.py friend quantself-friend.html

The resulting HTML file runs entirely offline — just double-click to open in any browser.
No server, no network required.
"""

import json
import os
import re
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(DIR, 'dist')
PUBLIC_DATA = os.path.join(DIR, 'public', 'data')


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 bundle_standalone.py <profile> [output.html]")
        sys.exit(1)

    profile = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else f'quantself-{profile}.html'

    profile_dir = os.path.join(PUBLIC_DATA, 'profiles', profile)
    if not os.path.isdir(profile_dir):
        print(f"ERROR: Profile '{profile}' not found at {profile_dir}")
        sys.exit(1)

    # Read dist/index.html
    index_path = os.path.join(DIST, 'index.html')
    if not os.path.isfile(index_path):
        print(f"ERROR: {index_path} not found. Run 'npm run build' first.")
        sys.exit(1)

    with open(index_path) as f:
        html = f.read()

    # Load profile data
    data = {}
    for name in ['cardiovascular', 'sleep', 'activity', 'overview', 'ecg']:
        fpath = os.path.join(profile_dir, f'{name}.json')
        if not os.path.isfile(fpath):
            print(f"WARNING: {fpath} missing, skipping")
            continue
        with open(fpath) as f:
            data[name] = json.load(f)

    # Build minimal registry with ONLY this profile
    full_registry_path = os.path.join(PUBLIC_DATA, 'profiles.json')
    with open(full_registry_path) as f:
        full_registry = json.load(f)
    profile_entry = next((p for p in full_registry['profiles'] if p['name'] == profile), None)
    if not profile_entry:
        print(f"ERROR: Profile '{profile}' not in profiles.json")
        sys.exit(1)
    registry = {'active': profile, 'profiles': [profile_entry]}

    # Build the data injection script (must run BEFORE main JS)
    # Escape HTML parser trigger sequences (HTML5 script data state)
    def html_escape_js(s):
        return (s
                .replace('</', '<\\/')
                .replace('<script', '<\\script')
                .replace('<!--', '<\\!--'))

    data_json = html_escape_js(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    registry_json = html_escape_js(json.dumps(registry, ensure_ascii=False, separators=(',', ':')))

    injection = (
        '<script>'
        'window.__QUANTSELF_SHARE_MODE__=true;'
        f'window.__QUANTSELF_REGISTRY__={registry_json};'
        f'window.__QUANTSELF_DATA__={data_json};'
        '</script>'
    )

    # Inline CSS
    def inline_css(match):
        href = match.group(1).lstrip('/')
        css_path = os.path.join(DIST, href)
        if not os.path.isfile(css_path):
            return match.group(0)
        with open(css_path) as f:
            return f'<style>{f.read()}</style>'

    html = re.sub(
        r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>',
        inline_css,
        html,
    )

    # Inline JS (module script)
    def inline_js(match):
        src = match.group(1).lstrip('/')
        js_path = os.path.join(DIST, src)
        if not os.path.isfile(js_path):
            return match.group(0)
        with open(js_path) as f:
            js_content = f.read()
        # Escape HTML parser triggers (script data state)
        js_content = html_escape_js(js_content)
        return f'<script type="module">{js_content}</script>'

    html = re.sub(
        r'<script[^>]*src="([^"]+)"[^>]*></script>',
        inline_js,
        html,
    )

    # Inject data script right after <head> so it runs before main JS
    html = html.replace('<head>', '<head>' + injection, 1)

    # Remove favicon link (optional - it's external)
    html = re.sub(
        r'<link[^>]*rel="icon"[^>]*>',
        '',
        html,
    )

    # Write output
    output_path = os.path.join(DIR, output) if not os.path.isabs(output) else output
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"Generated: {output_path}")
    print(f"Size: {size_mb:.2f} MB")
    print(f"Profile: {profile}")
    print(f"Data files: {list(data.keys())}")
    print()
    print("To use: double-click the HTML file or send it via WeChat/email.")
    print("It runs entirely offline — no server, no network required.")


if __name__ == '__main__':
    main()
