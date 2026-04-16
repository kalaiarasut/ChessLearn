import json
import sys
from pathlib import Path


def build_response() -> dict:
    try:
        import torch
    except Exception as exc:  # pragma: no cover - runtime health check
        return {
            "ok": False,
            "error": str(exc),
            "python": sys.executable,
            "cwd": str(Path.cwd()),
        }

    model_path = Path.cwd() / "models" / "chess_model.pt"
    sample = torch.tensor([[1.0, 2.0], [3.0, 4.0]])
    checksum = float(sample.matmul(sample).sum().item())

    return {
        "ok": True,
        "python": sys.executable,
        "torch_version": torch.__version__,
        "cuda_available": bool(torch.cuda.is_available()),
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "model_path": str(model_path),
        "model_present": model_path.exists(),
        "runtime_checksum": checksum,
    }


if __name__ == "__main__":
    print(json.dumps(build_response()))
