import type { Context } from "hono";

import { and, count, eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { emailAliases, matchesEmail } from "@/api/lib/user-email-lookup";
import { generateAvatarColor } from "@/api/modules/users/avatar-color";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { canonicalizeEmail } from "@/lib/email-canonical";
import { removeSpecialCharacters } from "@/lib/special-characters";

const getDefaultData = async (
  c: Context,
): Promise<{
  emailVerified: boolean;
  roleId: number;
}> => {
  const [countUsers] = await c
    .get("db")
    .select({ count: count() })
    .from(core_users);

  // If no users, return root group
  if (countUsers.count === 0) {
    const [defaultRole] = await c
      .get("db")
      .select({
        id: core_roles.id,
      })
      .from(core_roles)
      .where(and(eq(core_roles.default, false), eq(core_roles.root, true)))
      .limit(1);

    if (!defaultRole) {
      throw new HTTPException(400, {
        message: "Default group not found.",
      });
    }

    return {
      roleId: defaultRole.id,
      emailVerified: true,
    };
  }

  const [defaultRole] = await c
    .get("db")
    .select({
      id: core_roles.id,
    })
    .from(core_roles)
    .where(and(eq(core_roles.default, true), eq(core_roles.root, false)))
    .limit(1);

  if (!defaultRole) {
    throw new HTTPException(400, {
      message: "Default role not found.",
    });
  }

  return {
    roleId: defaultRole.id,
    emailVerified: !c.get("core").email?.adapter,
  };
};

export const signUp = async (
  {
    email: typedEmail,
    emailVerified: emailVerifiedByCaller,
    name,
    newsletter,
    hashedPassword,
  }: {
    email: string;
    emailVerified?: boolean;
    hashedPassword: string | undefined;
    name: string;
    newsletter?: boolean;
  },
  c: Context,
) => {
  const convertToNameSEO = removeSpecialCharacters(name);
  const email = canonicalizeEmail(typedEmail);
  const takenAddresses = new Set(emailAliases(typedEmail));
  const checkIfUserExist = await c
    .get("db")
    .select({
      email: core_users.email,
      name_code: core_users.nameCode,
    })
    .from(core_users)
    .where(
      or(matchesEmail(typedEmail), eq(core_users.nameCode, convertToNameSEO)),
    );

  const findEmail = checkIfUserExist.find(user =>
    takenAddresses.has(user.email),
  );
  if (findEmail) {
    throw new HTTPException(409, {
      message: "Email already exists",
    });
  }
  const findName = checkIfUserExist.find(
    user => user.name_code === convertToNameSEO,
  );
  if (findName) {
    throw new HTTPException(409, {
      message: "Name already exists",
    });
  }

  const defaults = await getDefaultData(c);
  const emailVerified = emailVerifiedByCaller ?? defaults.emailVerified;
  const [data] = await c
    .get("db")
    .insert(core_users)
    .values({
      email,
      name,
      nameCode: convertToNameSEO,
      // TODO: Handle newsletter only if email is allowed
      newsletter,
      password: hashedPassword,
      avatarColor: generateAvatarColor(name),
      roleId: defaults.roleId,
      emailVerified,
      ipAddress: c.get("ipAddress"),
      // TODO: Handle language
    })
    .returning();

  const { password: _, ...user } = data;

  // The insert above runs on `c.get("db")` (auto-commit), so the row is
  // committed here - even when a caller (e.g. the SSO callback) wraps this in
  // `db.transaction`. If this insert ever moves onto a `tx` handle, the emit
  // must move after that transaction returns.
  await c.get("events").emit("user.created", {
    userId: data.id,
    email: data.email,
    name: data.name,
    emailVerified: data.emailVerified,
  });

  return user;
};
