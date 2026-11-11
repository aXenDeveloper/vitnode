import { describe, expect, it } from "vitest";

import type { RoleNameWord, RoleUsersCount } from "./list-mapping";

import { withRolesAdminListFields } from "./list-mapping";

const ROLES = [
  { color: null, id: 3 },
  { color: "#123456", id: 1 },
  { color: null, id: 9 },
  { color: null, id: 4 },
];

const NAMES: RoleNameWord[] = [
  { itemId: 1, languageCode: "en", value: "Members" },
  { itemId: 3, languageCode: "en", value: "Administrators" },
  { itemId: 1, languageCode: "pl", value: "Uzytkownicy" },
  { itemId: 3, languageCode: "pl", value: "Administratorzy" },
  { itemId: 9, languageCode: "en", value: "Guests" },
];

const COUNTS: RoleUsersCount[] = [
  { roleId: 9, total: 0 },
  { roleId: 1, total: 412 },
  { roleId: 3, total: 2 },
];

const ADMIN_ROLE_IDS = new Set<null | number>([3, null]);

const page = () => ({
  adminRoleIds: ADMIN_ROLE_IDS,
  names: NAMES,
  roles: ROLES,
  userCounts: COUNTS,
});

describe("the role list's derived fields", () => {
  it("keep the page's own role order", () => {
    expect(withRolesAdminListFields(page()).map(role => role.id)).toEqual([
      3, 1, 9, 4,
    ]);
  });

  it("keep every column the page query selected", () => {
    expect(withRolesAdminListFields(page())[1]).toMatchObject({
      color: "#123456",
      id: 1,
    });
  });

  it("keep each role's translations in the order they arrived", () => {
    expect(withRolesAdminListFields(page())[0].name).toEqual([
      { languageCode: "en", name: "Administrators" },
      { languageCode: "pl", name: "Administratorzy" },
    ]);
  });

  it("give an untranslated role an empty list rather than nothing", () => {
    expect(withRolesAdminListFields(page())[3].name).toEqual([]);
  });

  it("give a role nobody holds a count of zero", () => {
    expect(withRolesAdminListFields(page())[3].usersCount).toBe(0);
  });

  it("keep a reported zero a zero rather than falling back over it", () => {
    expect(withRolesAdminListFields(page())[2].usersCount).toBe(0);
  });

  it("mark only the roles with an admin-permissions row", () => {
    expect(
      withRolesAdminListFields(page()).map(role => role.grantsAdmin),
    ).toEqual([true, false, false, false]);
  });
});
