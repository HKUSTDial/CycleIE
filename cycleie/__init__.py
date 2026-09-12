"""CycleIE: robust document information extraction through iterative
verification and refinement.

Reference implementation of the EMNLP 2026 Findings paper.
"""

from .core.document_manager import DocumentManager
from .core.state import CycleIEState
from .core.workflow import run_cycleie, stream_cycleie, stream_direct_qa

__version__ = "1.0.0"

__all__ = [
    "run_cycleie",
    "stream_cycleie",
    "stream_direct_qa",
    "CycleIEState",
    "DocumentManager",
    "__version__",
]
