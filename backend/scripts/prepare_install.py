"""Post-install checks and optional downloads, without changing existing projects."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--torch", choices=("cpu", "cu124", "cu126", "cu128", "cu130"), default="cpu")
    parser.add_argument("--prefetch-weights", action="store_true")
    parser.add_argument("--prefetch-flowers", action="store_true")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")

    import torch
    import torchvision
    from torchvision.ops import nms

    from app.core.config import get_settings
    from app.main import create_app

    print(f"PyTorch {torch.__version__}; torchvision {torchvision.__version__}", flush=True)
    if args.torch == "cpu" and torch.version.cuda is not None:
        raise RuntimeError("Expected CPU PyTorch, but found a CUDA build. Run setup with the matching -Torch option.")
    if args.torch != "cpu":
        expected = f"{args.torch[2:4]}.{args.torch[4:]}"
        if torch.version.cuda != expected:
            raise RuntimeError(f"Expected CUDA {expected}, found {torch.version.cuda}. Rerun setup with -Torch {args.torch}.")
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is unavailable. Check the NVIDIA driver, choose a compatible -Torch build, or run setup with -Torch cpu.")
        print(f"GPU: {torch.cuda.get_device_name(0)}", flush=True)
        torch.ones(1, device="cuda").cpu()

    # Exercise a compiled torchvision op to detect incompatible torch/torchvision wheels.
    assert nms(torch.tensor([[0.0, 0.0, 8.0, 8.0]]), torch.tensor([0.9]), 0.5).tolist() == [0]
    settings = get_settings()
    settings.ensure_dirs()
    torch.hub.set_dir(str(settings.torch_home / "hub"))
    create_app()  # Imports and route registration only; no database creation/mutation.
    print(f"Data directory: {settings.data_dir}", flush=True)

    if args.prefetch_weights:
        from app.ml.architectures import load_mobilenet_extractor

        print("Preparing pretrained MobileNetV3-Small weights...", flush=True)
        extractor = load_mobilenet_extractor(pretrained=True).eval()
        with torch.inference_mode():
            features = extractor(torch.zeros(1, 3, 224, 224))
        assert features.shape == (1, 576)
        print("Pretrained weights ready for offline use.", flush=True)

    if args.prefetch_flowers:
        from app.services.sample_datasets import ensure_flowers

        def progress(**fields):
            if fields.get("message"):
                print(fields["message"], flush=True)

        root = ensure_flowers(settings, progress)
        print(f"Flower Photos cache ready: {root}", flush=True)
    print("Backend checks passed.", flush=True)


if __name__ == "__main__":
    main()
