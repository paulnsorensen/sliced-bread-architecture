#!/usr/bin/env python3
"""Launcher for sliced-bread-guard. Needs Python 3.11+ (tomllib)."""

import sys
from pathlib import Path

if sys.version_info < (3, 11):
    sys.exit('sliced-bread-guard needs Python 3.11 or newer')

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sbguard_lib.cli import main  # noqa: E402

sys.exit(main())
