"""Smoke-test the guard catches a synthetic violation.

Verifies the regex actually fires on a known-bad fetch block. If this
test stops catching the violation, the guard is silently inert and the
FlowersRus-class bug can ship again.
"""
import subprocess
import tempfile
import os
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_guard_catches_synthetic_violation(tmp_path):
    # Stage a minimal "src/pages" tree with one offending file
    stage = tmp_path / "stage"
    (stage / "src" / "pages").mkdir(parents=True)
    bad_html = (stage / "src" / "pages" / "bad.html")
    bad_html.write_text("""
<html><body><script>
    fetch(API_BASE + '/api/v1/agents/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({})
    });
</script></body></html>
""")
    # Copy the guard script into the staged repo so it resolves the
    # roots relative to cwd.
    (stage / "scripts").mkdir()
    shutil.copy(REPO_ROOT / "scripts" / "check_credentials_include.py",
                stage / "scripts" / "check_credentials_include.py")
    result = subprocess.run(
        ["python3", "scripts/check_credentials_include.py"],
        cwd=stage, capture_output=True, text=True,
    )
    assert result.returncode == 1, f"guard didn't catch violation: {result.stdout}"
    assert "credentials" in result.stdout.lower()
    assert "bad.html" in result.stdout


def test_guard_passes_when_credentials_present(tmp_path):
    stage = tmp_path / "stage"
    (stage / "src" / "pages").mkdir(parents=True)
    good_html = (stage / "src" / "pages" / "good.html")
    good_html.write_text("""
<html><body><script>
    fetch(API_BASE + '/api/v1/agents/register', {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({})
    });
</script></body></html>
""")
    (stage / "scripts").mkdir()
    shutil.copy(REPO_ROOT / "scripts" / "check_credentials_include.py",
                stage / "scripts" / "check_credentials_include.py")
    result = subprocess.run(
        ["python3", "scripts/check_credentials_include.py"],
        cwd=stage, capture_output=True, text=True,
    )
    assert result.returncode == 0, f"guard false-positive: {result.stdout}"


def test_guard_exempts_get_requests(tmp_path):
    """GET to public-read endpoints doesn't need credentials."""
    stage = tmp_path / "stage"
    (stage / "src" / "pages").mkdir(parents=True)
    good_html = (stage / "src" / "pages" / "get.html")
    good_html.write_text("""
<html><body><script>
    fetch(API_BASE + '/api/v1/agents').then(r => r.json());
</script></body></html>
""")
    (stage / "scripts").mkdir()
    shutil.copy(REPO_ROOT / "scripts" / "check_credentials_include.py",
                stage / "scripts" / "check_credentials_include.py")
    result = subprocess.run(
        ["python3", "scripts/check_credentials_include.py"],
        cwd=stage, capture_output=True, text=True,
    )
    assert result.returncode == 0, f"guard false-positive on GET: {result.stdout}"
