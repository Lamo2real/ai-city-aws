"""Builds the one Lambda package all functions share: dist/lambda/app/.

It holds the ``aic`` package, its locked dependencies for Linux ARM64 (Python 3.13), the config files
(``aic/_config``) and the utility prompts (``aic/_agents/utility``). boto3 is left out: the Lambda runtime has
it. Terraform zips the folder; each function points at its own handler, e.g. ``aic.lambdas.api.handler``.

Run from anywhere:  python3 backend/scripts/build_lambdas.py   (needs uv)
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
OUT = BACKEND / "dist" / "lambda" / "app"
# Provided by the Lambda Python runtime.
SKIP = {"boto3", "botocore", "s3transfer", "jmespath", "python-dateutil", "six", "urllib3"}


def main() -> int:
    shutil.rmtree(OUT.parent, ignore_errors=True)
    OUT.mkdir(parents=True)
    exported = subprocess.run(
        ["uv", "export", "--frozen", "--no-dev", "--no-emit-project", "--no-hashes", "--no-header", "--no-annotate"],
        cwd=BACKEND,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    reqs = [
        line
        for line in exported.splitlines()
        if line.strip() and not line.startswith("#") and line.split("==")[0].split("[")[0].strip().lower() not in SKIP
    ]
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write("\n".join(reqs) + "\n")
        req_file = f.name
    subprocess.run(
        [
            "uv",
            "pip",
            "install",
            "--quiet",
            "--requirement",
            req_file,
            "--target",
            str(OUT),
            "--python-platform",
            "aarch64-manylinux_2_28",  # the Lambda Python 3.13 runtime is Amazon Linux 2023 (glibc 2.34)
            "--python-version",
            "3.13",
            "--only-binary",
            ":all:",
            "--no-deps",
        ],
        cwd=BACKEND,
        check=True,
    )
    shutil.copytree(BACKEND / "src" / "aic", OUT / "aic", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    shutil.copytree(ROOT / "config", OUT / "aic" / "_config")
    shutil.copytree(ROOT / "agents" / "utility", OUT / "aic" / "_agents" / "utility")
    for junk in OUT.rglob("__pycache__"):
        shutil.rmtree(junk, ignore_errors=True)
    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"built the Lambda package: {OUT.relative_to(ROOT)} ({size / 1e6:.1f} MB, {len(reqs)} dependencies)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
