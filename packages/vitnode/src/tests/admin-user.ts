import type { AdminUserDetail } from "@/views/admin/views/core/users/detail/user-query";

const MEMBER_ROLE = { color: null, id: 3, name: [] };

export const adminUserFixture = (
  overrides: Partial<AdminUserDetail> = {},
): AdminUserDetail => ({
  avatarColor: "#123456",
  avatarUrl: null,
  birthday: null,
  coverUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "moderator@example.com",
  emailVerified: true,
  firstName: null,
  headline: null,
  id: 7,
  imagePolicy: {
    avatar: { allowed: true, maxBytes: 1_000_000 },
    cover: { allowed: true, maxBytes: 1_000_000 },
  },
  isStaff: false,
  language: "en",
  lastName: null,
  name: "Moderator",
  nameCode: "moderator",
  newsletter: false,
  phone: null,
  role: MEMBER_ROLE,
  roleId: MEMBER_ROLE.id,
  secondaryRoles: [],
  showRealName: false,
  timeZone: null,
  ...overrides,
});
