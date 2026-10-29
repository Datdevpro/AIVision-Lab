"""Ensure setup cannot install packages in a system/shared Python environment."""
from pathlib import Path
import shutil
import subprocess
import sys

import pytest

from scripts import check_install_env


def test_reject_system_python(monkeypatch, tmp_path):
    monkeypatch.setattr(check_install_env.sys, "prefix", sys.base_prefix)
    with pytest.raises(RuntimeError, match="project venv"):
        check_install_env.validate_environment(tmp_path)


def test_reject_another_projects_venv(tmp_path):
    with pytest.raises(RuntimeError, match="project venv"):
        check_install_env.validate_environment(tmp_path)


def test_reject_venv_with_system_packages_enabled(monkeypatch, tmp_path):
    venv = tmp_path / "backend" / ".venv"
    venv.mkdir(parents=True)
    (venv / "pyvenv.cfg").write_text("include-system-site-packages = true\n", encoding="utf-8")
    monkeypatch.setattr(check_install_env.sys, "prefix", str(venv))
    with pytest.raises(RuntimeError, match="disable system site-packages"):
        check_install_env.validate_environment(tmp_path)


@pytest.mark.skipif(sys.platform != "win32", reason="Windows setup checks")
def test_windows_setup_gpu_selection_and_package_containment():
    powershell = shutil.which("powershell.exe")
    if not powershell:
        pytest.skip("Windows PowerShell is unavailable")
    result = subprocess.run(
        [powershell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
         str(Path(__file__).with_name("windows_setup_checks.ps1"))],
        capture_output=True, text=True, timeout=45,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "containment and hardware checks passed" in result.stdout
