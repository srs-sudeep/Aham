"""Example event — copy this pattern when adding real domain events.

    from contracts.events.example import ExampleItemCreated
    await outbox.add(session, ExampleItemCreated(item_id=item.id, name=item.name))
"""

from typing import ClassVar
import uuid

from platform_kit.messaging import Event


class ExampleItemCreated(Event):
    topic: ClassVar[str] = "example.item.created.v1"
    version: ClassVar[int] = 1

    item_id: uuid.UUID
    name: str
