"""Async events over Kafka (install `platform-kit[kafka]`, set KAFKA_ENABLED=true).

Publishing uses the TRANSACTIONAL OUTBOX: the event row is written in the same DB
transaction as the business change, and a background relay publishes it. You never
get "order saved but event lost" or "event sent but order rolled back".

    # modules/orders/service.py
    await self.repo.add(order)
    await outbox.add(self.repo.session, OrderCreated(order_id=order.id))
    await self.repo.commit()

Consuming:

    # modules/stock/events.py
    from platform_kit.messaging import subscriber
    from contracts.events.orders import OrderCreated

    @subscriber(OrderCreated, group="stock-service")
    async def on_order_created(event: OrderCreated) -> None: ...

Event schemas live in the shared `contracts` package so producer and consumer share one definition.
"""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any, ClassVar

from pydantic import BaseModel, Field
from sqlalchemy import JSON, DateTime, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from platform_kit.config import ServiceSettings
from platform_kit.context import get_request_id
from platform_kit.db import Base, Database
from platform_kit.logging import get_logger

log = get_logger("platform_kit.messaging")


class Event(BaseModel):
    """Base for every event. Subclasses set ``topic`` and ``version``."""

    topic: ClassVar[str]
    version: ClassVar[int] = 1

    event_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class OutboxMessage(Base):
    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(String(200), index=True)
    key: Mapped[str | None] = mapped_column(String(200))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    headers: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    dead_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(String(1000))


class outbox:  # noqa: N801 - namespace
    @staticmethod
    async def add(session: AsyncSession, event: Event, *, key: str | None = None) -> None:
        headers = {"event_type": type(event).__name__, "version": str(event.version)}
        if rid := get_request_id():
            headers["x-request-id"] = rid
        session.add(OutboxMessage(topic=event.topic, key=key, payload=event.model_dump(mode="json"), headers=headers))


# ── subscriber registry (filled at import time of modules/*/events.py) ───────
_SUBSCRIBERS: list[tuple[str, str, Callable[..., Awaitable[Any]]]] = []


def subscriber[E: Event](
    event_type: type[E], *, group: str
) -> Callable[[Callable[[E], Awaitable[Any]]], Callable[[E], Awaitable[Any]]]:
    def decorator(func: Callable[[E], Awaitable[Any]]) -> Callable[[E], Awaitable[Any]]:
        _SUBSCRIBERS.append((event_type.topic, group, func))
        return func

    return decorator


class Messaging:
    def __init__(self, settings: ServiceSettings, db: Database) -> None:
        from faststream.kafka import KafkaBroker  # optional dependency

        self.settings = settings
        self.db = db
        self.broker = KafkaBroker(settings.kafka_bootstrap_servers)
        self._relay: asyncio.Task[None] | None = None
        for topic, group, func in _SUBSCRIBERS:
            self.broker.subscriber(topic, group_id=group)(func)

    async def start(self) -> None:
        await self.broker.start()
        self._relay = asyncio.create_task(self._relay_loop(), name="outbox-relay")
        log.info("messaging_started", subscribers=len(_SUBSCRIBERS))

    async def stop(self) -> None:
        if self._relay:
            self._relay.cancel()
        # faststream renamed close() to stop() in 0.7; the pin allows >=0.5.30, so support both.
        shutdown = getattr(self.broker, "stop", None) or getattr(self.broker, "close", None)
        if shutdown is not None:
            await shutdown()

    async def ping(self) -> None:
        if self._relay is None or self._relay.done():
            raise RuntimeError("outbox relay not running")

    async def _relay_loop(self) -> None:
        while True:
            try:
                await self._relay_batch()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("outbox_relay_failed")
            await asyncio.sleep(self.settings.outbox_poll_seconds)

    async def _relay_batch(self, limit: int = 100) -> None:
        max_attempts = self.settings.outbox_max_attempts
        async with self.db.session() as session:
            stmt = (
                select(OutboxMessage)
                .where(OutboxMessage.sent_at.is_(None), OutboxMessage.dead_at.is_(None))
                .order_by(OutboxMessage.created_at)
                .limit(limit)
            )
            if self.db.engine.dialect.name == "postgresql":
                stmt = stmt.with_for_update(skip_locked=True)  # safe with several replicas
            for msg in (await session.scalars(stmt)).all():
                try:
                    await self.broker.publish(
                        msg.payload,
                        topic=msg.topic,
                        key=msg.key.encode() if msg.key else None,
                        headers=msg.headers,
                    )
                    msg.sent_at = datetime.now(UTC)
                except Exception as exc:
                    msg.attempts += 1
                    msg.last_error = str(exc)[:1000]
                    if msg.attempts >= max_attempts:
                        msg.dead_at = datetime.now(UTC)
                        log.error(
                            "outbox_poisoned",
                            topic=msg.topic,
                            attempts=msg.attempts,
                            error=str(exc),
                        )
                    else:
                        log.warning(
                            "outbox_publish_failed",
                            topic=msg.topic,
                            attempts=msg.attempts,
                            error=str(exc),
                        )
            await session.commit()
