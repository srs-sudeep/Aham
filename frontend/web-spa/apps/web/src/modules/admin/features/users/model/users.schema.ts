import { z } from "zod";

/** Wire + domain shape for a tenant membership (GET /auth/users). */
export type TenantUser = {
  userId: string;
  email: string;
  status: string;
  membershipStatus: string;
  roleId: string;
  role: string;
};

export type TenantUserDto = {
  user_id: string;
  email: string;
  status: string;
  membership_status: string;
  role_id: string;
  role: string;
};

export function toTenantUser(dto: TenantUserDto): TenantUser {
  return {
    userId: dto.user_id,
    email: dto.email,
    status: dto.status,
    membershipStatus: dto.membership_status,
    roleId: dto.role_id,
    role: dto.role,
  };
}

export const inviteFormSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
});

export type InviteFormValues = z.infer<typeof inviteFormSchema>;

export type UpdateTenantUserInput = {
  role?: string;
  membershipStatus?: "active" | "disabled";
};
