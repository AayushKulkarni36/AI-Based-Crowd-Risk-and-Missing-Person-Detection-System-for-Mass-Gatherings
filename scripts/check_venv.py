"""
Utility to verify that the project virtual environment is active and configured.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def collect_context() -> dict:
    project_root = Path(__file__).resolve().parents[1]
    expected_venv = project_root / "venv"

    context = {
        "project_root": str(project_root),
        "expected_venv": str(expected_venv),
        "sys_prefix": str(Path(sys.prefix).resolve()),
        "python_executable": str(Path(sys.executable).resolve()),
        "site_packages": None,
        "is_expected_prefix": Path(sys.prefix).resolve() == expected_venv.resolve(),
    }

    for candidate in sys.path:
        candidate_path = Path(candidate)
        if "site-packages" in candidate_path.parts:
            context["site_packages"] = str(candidate_path.resolve())
            break

    return context


def main() -> None:
    context = collect_context()
    print(json.dumps(context, indent=2))

    if not context["is_expected_prefix"]:
        raise SystemExit(
            "Virtual environment is not active. "
            "Run 'activate_venv.bat' (Command Prompt) or 'activate_venv.ps1' (PowerShell) first."
        )


if __name__ == "__main__":
    main()

