import type { ApiClient } from "@aham/ui-kit";
import {
  toPermissionCatalogEntry,
  toRole,
  type CreateRoleFormValues,
  type PermissionCatalogDto,
  type PermissionCatalogEntry,
  type Role,
  type RoleDto,
  type SetRolePermissionsInput,
  type UpdateRoleInput,
} from "../model/roles.schema";

/** Thin HTTP layer for identity roles / permission catalog. */
export const rolesApi = {
  async list(client: ApiClient): Promise<Role[]> {
    const rows = await client.get<RoleDto[]>("/auth/roles");
    return rows.map(toRole);
  },

  async get(client: ApiClient, roleId: string): Promise<Role> {
    const dto = await client.get<RoleDto>(`/auth/roles/${encodeURIComponent(roleId)}`);
    return toRole(dto);
  },

  async create(client: ApiClient, input: CreateRoleFormValues): Promise<Role> {
    const dto = await client.post<RoleDto>("/auth/roles", {
      name: input.name,
      permissions: input.permissions,
    });
    return toRole(dto);
  },

  async update(client: ApiClient, roleId: string, input: UpdateRoleInput): Promise<Role> {
    const dto = await client.patch<RoleDto>(`/auth/roles/${encodeURIComponent(roleId)}`, {
      name: input.name,
    });
    return toRole(dto);
  },

  async remove(client: ApiClient, roleId: string): Promise<void> {
    await client.delete(`/auth/roles/${encodeURIComponent(roleId)}`);
  },

  async setPermissions(
    client: ApiClient,
    roleId: string,
    input: SetRolePermissionsInput,
  ): Promise<Role> {
    const dto = await client.put<RoleDto>(`/auth/roles/${encodeURIComponent(roleId)}/permissions`, {
      permissions: input.permissions,
    });
    return toRole(dto);
  },

  async listPermissions(client: ApiClient): Promise<PermissionCatalogEntry[]> {
    const rows = await client.get<PermissionCatalogDto[]>("/auth/permissions");
    return rows.map(toPermissionCatalogEntry);
  },
};
