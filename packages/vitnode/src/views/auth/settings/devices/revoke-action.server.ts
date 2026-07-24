"use server";

import { revalidatePath } from "next/cache";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

export const revokeDeviceAction = async ({
  publicId,
}: {
  publicId: string;
}): Promise<{ data?: true; error?: { status: number } }> => {
  const res = await fetcher(usersModule, {
    path: "/devices/{publicId}",
    method: "delete",
    module: "users",
    args: {
      params: { publicId },
    },
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/(main)", "layout");

  return { data: true };
};
