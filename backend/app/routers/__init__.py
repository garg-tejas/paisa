"""FastAPI routers for the paisa backend.

Each router defines its own absolute paths (no extra prefix is applied when
mounted in main.py). Routers are imported lazily by main.py so that a missing
sibling module (owned by another agent during development) does not crash the
whole app on import.
"""
