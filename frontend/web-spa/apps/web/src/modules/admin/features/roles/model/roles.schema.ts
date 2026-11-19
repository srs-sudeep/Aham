import { z } from "zod";

/** Wire + domain shape for a role (GET /auth/roles). */
export type Role = {
  id: string;
  name: string;
  isSystem: boolean;
  tenantId: string | null;
  permissions: string[];
};

export type RoleDto = {
  id: string;
  name: string;
  is_system: boolean;
  tenant_id: string | null;
  permissions: string[];
};

export function toRole(dto: RoleDto): Role {
  return {
    id: dto.id,
    name: dto.name,
    isSystem: dto.is_system,
    tenantId: dto.tenant_id,
    permissions: dto.permissions,
  };
}

export type PermissionCatalogEntry = {
  code: string;
  description: string | null;
};

export type PermissionCatalogDto = {
  code: string;
  description: string | null;
};

export function toPermissionCatalogEntry(dto: PermissionCatalogDto): PermissionCatalogEntry {
  return { code: dto.code, description: dto.description };
}

export const createRoleFormSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, "Must be snake_case starting with a letter"),
  permissions: z.array(z.string()),
});

export type CreateRoleFormValues = z.infer<typeof createRoleFormSchema>;

export type UpdateRoleInput = {
  name?: string;
};

export type SetRolePermissionsInput = {
  permissions: string[];
};
