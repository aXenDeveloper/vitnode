import { revalidateTag } from 'next/cache';

export enum RevalidateTagEnum {
  Admin_Core_Sessions = 'admin_core_sessions',
  Core_Global = 'core_global',
  Core_Members__Profiles = 'core_members__profiles',
  Core_Session = 'core_session',
  Core_Terms_Show = 'core_terms__show',
}

export const revalidateTags = {
  session: (userId: number) => {
    if (userId) {
      revalidateTag(`${RevalidateTagEnum.Core_Session}--${userId}`);
    }
    // Revalidate tag also for guest users
    revalidateTag(RevalidateTagEnum.Core_Session);
  },
  sessionAdmin: (adminId: number) => {
    if (adminId) {
      revalidateTag(`${RevalidateTagEnum.Admin_Core_Sessions}--${adminId}`);
    }
    // Revalidate tag also for guest
    revalidateTag(RevalidateTagEnum.Admin_Core_Sessions);
  },
  terms: (code: string, prevCode?: string) => {
    revalidateTag(RevalidateTagEnum.Core_Terms_Show);
    revalidateTag(`${RevalidateTagEnum.Core_Terms_Show}--${code}`);
    if (prevCode) {
      revalidateTag(`${RevalidateTagEnum.Core_Terms_Show}--${prevCode}`);
    }
  },
};
