"""Shared, versioned event schemas.

Producers and consumers import event classes from ``contracts.events.*``.
Treat this package as append-only: a breaking field change means a new class
with ``version`` incremented and a ``.v2`` topic (see AGENTS.md).
"""
