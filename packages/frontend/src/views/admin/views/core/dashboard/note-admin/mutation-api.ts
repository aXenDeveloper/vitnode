'use server';

import { fetcher } from '@/api/fetcher';
import {
  EditNoteDashboardBody,
  NoteDashboard,
} from 'vitnode-shared/admin/dashboard.dto';

import { revalidateAllApi } from '../../diagnostic/actions/clear_cache/hooks/revalidate-all-api';

export const mutationApi = async (body: EditNoteDashboardBody) => {
  await fetcher<NoteDashboard, EditNoteDashboardBody>({
    url: '/admin/dashboard/edit-note',
    method: 'PUT',
    body,
  });
  await revalidateAllApi();
};
