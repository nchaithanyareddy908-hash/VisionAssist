import sys
from pathlib import Path

# Make the repository root importable when Vercel loads this function.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.main import app

__all__ = ["app"]
