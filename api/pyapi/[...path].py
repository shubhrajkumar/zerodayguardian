from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
PYTHON_ROOT = ROOT / "backend" / "python"

if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from app import app  # noqa: E402

