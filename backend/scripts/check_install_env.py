"""Refuse package installation outside this project's isolated virtual environment."""
from __future__ import annotations

import argparse
from pathlib import Path
import site
import sys
import sysconfig


def validate_environment(root: Path) -> None:
    expected = (root / "backend" / ".venv").resolve()
    if sys.prefix == sys.base_prefix or Path(sys.prefix).resolve() != expected:
        raise RuntimeError(f"Packages must be installed in the project venv: {expected}")
    config = expected / "pyvenv.cfg"
    entries = {}
    for line in config.read_text(encoding="utf-8").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            entries[key.strip().lower()] = value.strip().lower()
    if entries.get("include-system-site-packages") != "false":
        raise RuntimeError("The project venv must disable system site-packages.")
    if site.ENABLE_USER_SITE:
        raise RuntimeError("User site-packages must be disabled.")
    for name in ("purelib", "platlib", "scripts"):
        if not Path(sysconfig.get_path(name)).resolve().is_relative_to(expected):
            raise RuntimeError(f"Python {name} points outside the project venv.")
    import pip

    if not Path(pip.__file__).resolve().is_relative_to(expected):
        raise RuntimeError("pip must be installed inside the project venv.")
    for entry in sys.path:
        path = Path(entry).resolve()
        if "site-packages" in path.parts and not path.is_relative_to(expected):
            raise RuntimeError(f"External site-packages are enabled: {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    validate_environment(args.root)
    print(f"Package destination verified: {Path(sys.prefix) / 'Lib' / 'site-packages'}", flush=True)
