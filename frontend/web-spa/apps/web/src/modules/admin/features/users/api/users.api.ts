import type { ApiClient } from "@aham/ui-kit";
import {
  toTenantUser,
  type InviteFormValues,
  type TenantUser,
  type TenantUserDto,
  type UpdateTenantUserInput,
} from "../model/users.schema";

/** Thin HTTP layer for identity user/membership admin. */
export const usersApi = {
  async list(client: ApiClient): Promise<TenantUser[]> {
    const rows = await client.get<TenantUserDto[]>("/auth/users");
    return rows.map(toTenantUser);
  },

  async invite(client: ApiClient, input: InviteFormValues): Promise<void> {
    await client.post<unknown>("/auth/invitations", {
      email: input.email,
      role: input.role,
    });
  },

  async update(
    client: ApiClient,
    userId: string,
    input: UpdateTenantUserInput,
  ): Promise<TenantUser> {
    const dto = await client.patch<TenantUserDto>(`/auth/users/${encodeURIComponent(userId)}`, {
      role: input.role,
      membership_status: input.membershipStatus,
    });
    return toTenantUser(dto);
  },
};
