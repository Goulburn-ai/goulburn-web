"""Production smoke test — every load-bearing static URL on goulburn-web.

Run after every deploy:
    python3 scripts/smoke_load_bearing_urls.py

Fails (non-zero exit) if ANY listed URL returns 4xx/5xx. Catches the class
of bug that hit on 2026-05-10 where `/oauth/callback` was deleted but
`register.html` still pointed at it — production 404 only surfaced when a
real user tried Google OAuth on /agents/register.

Add new entries to LOAD_BEARING below whenever you ship a new URL that is
constructed dynamically in JS (so static reference-checking can't catch it).
"""
from __future__ import annotations
import sys
import urllib.request
import urllib.error

BASE = "https://goulburn.ai"

# Each entry: (path, expected_status, who_references_it)
LOAD_BEARING = [
    ("/oauth/callback?test=smoke",     200, "register.html OAuth init (line ~2045) — bouncer for legacy /api/v1/oauth/* flow"),
    ("/auth/verify?token=smoketest",   200, "magic-link emails — auth-verify.html"),
    ("/sign-in",                       200, "primary auth surface"),
    ("/agents/register",               200, "agent registration page"),
    ("/dashboard",                     200, "operator dashboard (gated, 200 served as static shell)"),
    ("/settings",                      200, "operator settings"),
    ("/agents",                        200, "agent directory"),
    ("/operator/me?edit=1",            200, "new-operator profile setup deep-link"),
    ("/probes",                        200, "probe explainer"),
    ("/how-it-works",                  200, "explainer"),
    ("/about",                         200, "about page"),
    ("/api/docs",                      200, "API docs"),
    ("/unauthorized",                  200, "401 fallback page"),
    ("/maintenance",                   200, "maintenance page"),
    ("/share",                         200, "trust-share page"),
    ("/labs/stance-map",               200, "labs prototype"),
    ("/goulburn-emblem.svg",           200, "dropdown avatar asset"),
    ("/widget.js",                     200, "embed badge script"),
    ("/agent-visuals.js",              200, "shared agent rendering helper"),
]

failures: list[tuple[str, int, str]] = []
passes = 0

for path, expected, ref in LOAD_BEARING:
    url = BASE + path
    req = urllib.request.Request(url, headers={"User-Agent": "goulburn-smoke/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            actual = resp.status
    except urllib.error.HTTPError as e:
        actual = e.code
    except Exception as e:
        actual = -1
        ref = ref + f"  [{type(e).__name__}: {e}]"
    if actual == expected:
        passes += 1
        print(f"  ✓ {actual} {path}")
    else:
        failures.append((path, actual, ref))
        print(f"  ✗ {actual} {path}  (expected {expected})  — {ref}")

print()
print(f"Pass: {passes} / {len(LOAD_BEARING)}")
if failures:
    print(f"\nFAIL: {len(failures)} load-bearing URL(s) regressed:")
    for path, actual, ref in failures:
        print(f"  {actual} {path}\n      referenced by: {ref}")
    sys.exit(1)

print("\nAll load-bearing URLs resolve.")
sys.exit(0)
