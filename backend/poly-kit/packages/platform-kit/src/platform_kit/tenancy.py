"""Tenant context and Postgres RLS helpers.

Isolation is separate from authorization (AWS SaaS guidance): a valid token for
tenant A must never read tenant B rows. Application filters + RLS fail closed.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from platform_kit.context import tenant_id_var
from platform_kit.errors import ForbiddenError
from platform_kit.security import CurrentPrincipal, Principal


async def set_tenant_rls(session: AsyncSession, tenant_id: uuid.UUID | str) -> None:
    """Bind the DB session to a tenant for Postgres RLS (transaction-local)."""
    await session.execute(text("SELECT set_config('app.tenant_id', :tid, true)"), {"tid": str(tenant_id)})


async def clear_tenant_rls(session: AsyncSession) -> None:
    await session.execute(text("SELECT set_config('app.tenant_id', '', true)"))


def require_tenant(principal: Principal) -> uuid.UUID:
    if not principal.tid:
        raise ForbiddenError(detail="token is missing tenant claim (tid)")
    try:
        return uuid.UUID(principal.tid)
    except ValueError as exc:
        raise ForbiddenError(detail=f"invalid tenant claim: {principal.tid}") from exc


async def bind_tenant_context(principal: CurrentPrincipal, request: Request) -> uuid.UUID:
    """Dependency: require tid, set contextvar, apply RLS on the request session if present."""
    tid = require_tenant(principal)
    tenant_id_var.set(str(tid))
    session: AsyncSession | None = getattr(request.state, "db_session", None)
    if session is not None:
        await set_tenant_rls(session, tid)
    return tid


TenantIdDep = Annotated[uuid.UUID, Depends(bind_tenant_context)]


def assert_same_tenant(resource_tenant_id: uuid.UUID | str, principal: Principal) -> None:
    """Fail closed when a resource's tenant does not match the token."""
    expected = require_tenant(principal)
    actual = uuid.UUID(str(resource_tenant_id))
    if actual != expected:
        raise ForbiddenError(detail=f"tenant mismatch: token={expected} resource={actual}")


# SQL snippet for Alembic migrations / enable_rls helpers
RLS_POLICY_SQL = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON {table};
CREATE POLICY tenant_isolation ON {table}
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
"""


def enable_rls_sql(table: str) -> str:
    return RLS_POLICY_SQL.format(table=table)
