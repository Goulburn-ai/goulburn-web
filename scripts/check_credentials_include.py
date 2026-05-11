#!/usr/bin/env python3
"""Fail-fast guard: every cross-origin fetch() to api.goulburn.ai or
admin.goulburn.ai that mutates state (POST/PUT/PATCH/DELETE) must carry
`credentials: 'include'` in its options object.

Without this flag, the browser strips the gb_session cookie on cross-
origin requests, the backend's optional-owner Depends resolves to None,
and authed actions (agent registration, settings updates, etc.) silently
fail. The agent goes into the orphan pool with owner_id=NULL.

Caught 2026-05-10 — FlowersRus orphan-binding incident. The "Register
via API" tab on /agents/register fired its registration POST without
credentials:'include' for the entire life of the tab; only a code review
spotted it. This script makes the bug class impossible to ship.

Runs in CI on every push. Returns non-zero exit on any violation.
"""
from __future__ import annotations

import glob
import re
import sys
from pathlib import Path


def _balanced_options(src: str, start: int) -> tuple[int, str] | None:
    """Starting at `start` (which must point at '{'), return the index
    just past the matching closing brace plus the content between them.
    Returns None if no balanced match within 1000 chars.
    """
    if start >= len(src) or src[start] != "{":
        return None
    depth = 0
    i = start
    limit = min(len(src), start + 1000)
    while i < limit:
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i + 1, src[start : i + 1]
        i += 1
    return None


# Match fetch( ... ,  — finds fetch calls whose URL hits api/admin.goulburn.ai.
# The capture is the END of the comma; the options object starts after.
FETCH_OPEN = re.compile(
    r"""fetch\s*\(\s*
        (?:
            API_BASE | apiBase | ADMIN_BASE | adminBase
            | ['"]https?://(?:api|admin)\.goulburn\.ai
        )
        [^,(]*?                  # URL expression chunk (no commas/parens at top level)
        (?:\([^)]*\)[^,(]*?)*    # allow nested calls like encodeURIComponent(x)
        ,\s*
    """,
    re.VERBOSE,
)


def file_violations(path: str) -> list[tuple[int, str]]:
    try:
        src = Path(path).read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []
    out: list[tuple[int, str]] = []
    for m in FETCH_OPEN.finditer(src):
        # Find the matching options object that starts after the comma.
        opts_start = m.end()
        # Skip whitespace
        while opts_start < len(src) and src[opts_start] in " \t\n\r":
            opts_start += 1
        if opts_start >= len(src) or src[opts_start] != "{":
            continue
        balanced = _balanced_options(src, opts_start)
        if balanced is None:
            continue
        _, opts = balanced

        # Exempt GETs — public reads don't need credentials.
        method_match = re.search(r"method\s*:\s*['\"]([A-Z]+)['\"]", opts)
        method = method_match.group(1).upper() if method_match else "GET"
        if method == "GET":
            continue
        if "credentials" in opts:
            continue
        line = src[: m.start()].count("\n") + 1
        block = (src[m.start() : opts_start] + opts).replace("\n", " ")[:300]
        out.append((line, block))
    return out


def main() -> int:
    roots = ["src/pages", "src/static", "src/partials"]
    violations: list[tuple[str, int, str]] = []
    for root in roots:
        for pattern in (f"{root}/**/*.html", f"{root}/**/*.js"):
            for path in glob.glob(pattern, recursive=True):
                for line, block in file_violations(path):
                    violations.append((path, line, block))

    if violations:
        print(
            "::error::Found cross-origin fetch() calls to api/admin.goulburn.ai "
            "that mutate state (POST/PUT/PATCH/DELETE) without "
            "`credentials: 'include'`.\n"
            "Without this flag, the gb_session cookie is stripped on cross-origin "
            "requests and the backend orphans the resulting writes (owner_id=NULL).\n"
            "Caught 2026-05-10 — FlowersRus orphan-binding incident.\n"
        )
        for path, line, block in violations:
            print(f"  ❌ {path}:{line}")
            print(f"       {block}")
            print()
        print(
            f"\nFix: add `credentials: 'include'` to the options object for each "
            f"violation above.\nTotal violations: {len(violations)}"
        )
        return 1

    print(f"✅ Credentials-include guard passed across {len(roots)} root(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
