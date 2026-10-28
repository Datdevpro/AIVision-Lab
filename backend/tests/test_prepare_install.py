"""Installation diagnostics must work even when Windows cannot import torch."""
import builtins
from pathlib import Path
import shutil
import subprocess
import sys

import pytest

from scripts import prepare_install


def test_diagnose_does_not_import_torch(monkeypatch, capsys):
    original = builtins.__import__

    def reject_torch(name, *args, **kwargs):
        if name == "torch" or name.startswith("torch.") or name == "torchvision":
            raise AssertionError("Diagnostics must not import a broken native package")
        return original(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", reject_torch)
    monkeypatch.setattr(prepare_install.sys, "argv", ["prepare_install.py", "--diagnose"])
    prepare_install.main()
    output = capsys.readouterr().out
    assert "Python:" in output
    assert "Installed torch:" in output
    assert "Installed torchvision:" in output


def test_windows_dll_failure_gives_remedy_and_preserves_original_error(monkeypatch, capsys):
    original = builtins.__import__

    def broken_torch(name, *args, **kwargs):
        if name == "torch":
            raise OSError("[WinError 1114] Error loading torch/lib/c10.dll")
        return original(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", broken_torch)
    monkeypatch.setattr(prepare_install.sys, "platform", "win32")
    monkeypatch.setattr(prepare_install.sys, "argv", ["prepare_install.py"])
    with pytest.raises(SystemExit) as exc:
        prepare_install.main()
    assert exc.value.code == 1
    errors = capsys.readouterr().err
    assert "WinError 1114" in errors and "c10.dll" in errors
    assert "-InstallVCRuntime" in errors
    assert "-CpuCompatibility" in errors
    assert "cannot distinguish" in errors


@pytest.mark.skipif(sys.platform != "win32", reason="Windows PowerShell installer checks")
def test_vc_runtime_installer_decisions_without_installing_system_packages():
    powershell = shutil.which("powershell.exe")
    if not powershell:
        pytest.skip("Windows PowerShell is unavailable")
    result = subprocess.run(
        [powershell, "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
         str(Path(__file__).with_name("windows_runtime_checks.ps1"))],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Windows runtime installer checks passed." in result.stdout
