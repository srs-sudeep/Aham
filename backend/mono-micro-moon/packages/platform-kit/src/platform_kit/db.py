"""Async SQLAlchemy: engine, session dependency, declarative Base, base repository.

Transactions are explicit: repositories ``flush``; services call ``await repo.commit()``
at the end of a write use-case. The request session is rolled back on any error.
"""

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import Depends, Request
from sqlalchemy import DateTime, MetaData, func, select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.pool import StaticPool

from platform_kit.config import ServiceSettings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKey:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Timestamps:
    # Python-side defaults: values are on the object right after flush (no async lazy-load).
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, server_default=func.now()
    )


class TenantScopedMixin:
    """Mark a table as tenant-owned. Pair with Postgres RLS (see platform_kit.tenancy)."""

    tenant_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)


class Database:
    def __init__(self, settings: ServiceSettings) -> None:
        url = settings.database_url
        kwargs: dict[str, Any] = {"echo": settings.db_echo}
        if url.startswith("sqlite"):
            kwargs |= {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}
        else:
            kwargs |= {"pool_size": settings.db_pool_size, "pool_pre_ping": True}
        self.engine: AsyncEngine = create_async_engine(url, **kwargs)
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        async with self.sessionmaker() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    async def ping(self) -> None:
        async with self.engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

    async def create_all(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def drop_all(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    async def dispose(self) -> None:
        await self.engine.dispose()


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    from platform_kit.context import tenant_id_var
    from platform_kit.tenancy import set_tenant_rls

    db: Database = request.app.state.db
    async with db.session() as session:
        request.state.db_session = session
        tid = tenant_id_var.get()
        if tid:
            await set_tenant_rls(session, tid)
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]

class BaseRepository[ModelT: Base]:
    """Generic CRUD helpers. Subclass per module and add query methods there."""

    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, id_: Any) -> ModelT | None:
        return await self.session.get(self.model, id_)

    async def list(self, *, offset: int = 0, limit: int = 50) -> list[ModelT]:
        result = await self.session.scalars(select(self.model).offset(offset).limit(limit))
        return list(result)

    async def add(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.flush()

    async def commit(self) -> None:
        await self.session.commit()
