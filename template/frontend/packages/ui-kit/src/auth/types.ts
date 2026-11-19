export type Action = "create" | "read" | "update" | "delete" | "list" | "*";

export type Permission = `${string}:${Action}` | "public";

export type Principal = {
  id: string;
  email?: string;
  name?: string;
  /** Active tenant from the access token (`tid`); null for tenant-less principals. */
  tenantId?: string | null;
  permissions: Permission[];
  roles?: string[];
};

export function hasPermission(
  principal: Principal | null | undefined,
  required: Permission | Permission[],
): boolean {
  if (!required || required === "public") return true;
  if (!principal) return false;
  const needed = Array.isArray(required) ? required : [required];
  const owned = new Set<string>(principal.permissions);
  if (owned.has("*") || owned.has("*:*")) return true;
  return needed.every((p) => {
    if (owned.has(p)) return true;
    const [resource, action] = p.split(":");
    return owned.has(`${resource}:*`) || owned.has(`*:${action}`);
  });
}
