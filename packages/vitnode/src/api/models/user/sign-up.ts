import type { Context } from 'hono';

import { and, count, eq, or } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { getUserIp } from '@/api/lib/get-user-ip';
import { generateAvatarColor } from '@/api/modules/users/avatar-color';
import { core_roles } from '@/database/roles';
import { core_users } from '@/database/users';
import { removeSpecialCharacters } from '@/lib/special-characters';

const getDefaultData = async (
  c: Context,
): Promise<{
  emailVerified: boolean;
  roleId: number;
}> => {
  const [countUsers] = await c
    .get('db')
    .select({ count: count() })
    .from(core_users);

  // If no users, return root group
  if (countUsers.count === 0) {
    const [defaultRole] = await c
      .get('db')
      .select({
        id: core_roles.id,
      })
      .from(core_roles)
      .where(and(eq(core_roles.default, false), eq(core_roles.root, true)))
      .limit(1);

    if (!defaultRole) {
      throw new HTTPException(400, {
        message: 'Default group not found.',
      });
    }

    return {
      roleId: defaultRole.id,
      emailVerified: true,
    };
  }

  const [defaultRole] = await c
    .get('db')
    .select({
      id: core_roles.id,
    })
    .from(core_roles)
    .where(and(eq(core_roles.default, true), eq(core_roles.root, false)))
    .limit(1);

  if (!defaultRole) {
    throw new HTTPException(400, {
      message: 'Default role not found.',
    });
  }

  return {
    roleId: defaultRole.id,
    emailVerified: !c.get('core').emailAdapter,
  };
};

export const signUp = async (
  {
    email,
    name,
    newsletter,
    hashedPassword,
  }: {
    email: string;
    hashedPassword: string | undefined;
    name: string;
    newsletter?: boolean;
  },
  c: Context,
) => {
  const convertToNameSEO = removeSpecialCharacters(name);
  const checkIfUserExist = await c
    .get('db')
    .select({
      email: core_users.email,
      name_code: core_users.nameCode,
    })
    .from(core_users)
    .where(
      or(
        eq(core_users.email, email),
        eq(core_users.nameCode, convertToNameSEO),
      ),
    );

  const findEmail = checkIfUserExist.find(user => user.email === email);
  if (findEmail) {
    throw new HTTPException(400, {
      message: 'Email already exists',
    });
  }
  const findName = checkIfUserExist.find(
    user => user.name_code === convertToNameSEO,
  );
  if (findName) {
    throw new HTTPException(400, {
      message: 'Name already exists',
    });
  }

  const { roleId, emailVerified } = await getDefaultData(c);
  const [data] = await c
    .get('db')
    .insert(core_users)
    .values({
      email,
      name,
      nameCode: convertToNameSEO,
      // TODO: Handle newsletter only if email is allowed
      newsletter,
      password: hashedPassword,
      avatarColor: generateAvatarColor(name),
      roleId,
      emailVerified,
      ipAddress: getUserIp(c),
      // TODO: Handle language
      // language: await this.getLanguage(req),
    })
    .returning();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...user } = data;

  return user;
};
