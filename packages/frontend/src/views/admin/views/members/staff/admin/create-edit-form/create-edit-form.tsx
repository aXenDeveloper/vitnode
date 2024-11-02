import { getGroupsShortApi } from '@/api/get-groups-short-api';
import { getUsersShortApi } from '@/api/get-users-short-api';
import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormCombobox } from '@/components/form/fields/combobox';
import { AutoFormRadioGroup } from '@/components/form/fields/radio-group';
import { AutoFormSwitch } from '@/components/form/fields/switch';
import { AvatarUser } from '@/components/ui/user/avatar';
import { GroupFormat } from '@/components/ui/user/group-format';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AdminStaffMembersAdminObj } from 'vitnode-shared/admin/members/staff/admin.dto';

import { PermissionsField } from '../../permissions-field';
import { useFormCreateEditFormGroupsMembersAdmin } from './hooks/use-form';

export const CreateEditFormAdministratorsStaffAdmin = ({
  permissions,
  data,
}: {
  data?: AdminStaffMembersAdminObj['edges'][0];
  permissions: AdminStaffMembersAdminObj['permissions'];
}) => {
  const t = useTranslations('admin.members.staff.shared');
  const tCore = useTranslations('core.global.errors');
  const { onSubmit, formSchema } = useFormCreateEditFormGroupsMembersAdmin({
    data,
  });

  return (
    <>
      <AutoForm
        dependencies={[
          {
            sourceField: 'type',
            type: DependencyType.HIDES,
            targetField: 'type',
            when: () => !!data,
          },
          {
            sourceField: 'type',
            type: DependencyType.HIDES,
            targetField: 'group',
            when: (provider: 'group' | 'user') =>
              provider !== 'group' || !!data,
          },
          {
            sourceField: 'type',
            type: DependencyType.HIDES,
            targetField: 'user',
            when: (provider: 'group' | 'user') => provider !== 'user' || !!data,
          },
          {
            sourceField: 'unrestricted',
            type: DependencyType.HIDES,
            targetField: 'permissions',
            when: (unrestricted: boolean) => unrestricted,
          },
          {
            sourceField: 'type',
            type: DependencyType.REQUIRES,
            targetField: 'user',
            when: (provider: 'group' | 'user') => provider === 'user',
          },
          {
            sourceField: 'type',
            type: DependencyType.REQUIRES,
            targetField: 'group',
            when: (provider: 'group' | 'user') => provider === 'group',
          },
        ]}
        fields={[
          {
            id: 'type',
            label: t('type'),
            component: props => (
              <AutoFormRadioGroup
                {...props}
                hideOptionalLabel
                labels={{
                  group: {
                    title: t('group'),
                  },
                  user: {
                    title: t('user'),
                  },
                }}
              />
            ),
          },
          {
            id: 'group',
            label: t('group'),
            component: props => (
              <AutoFormCombobox
                {...props}
                withFetcher={{
                  queryKey: 'Admin__Core_Groups__Show_Short',
                  search: true,
                  queryFn: async ({ search }) => {
                    try {
                      const mutation = await getGroupsShortApi({ search });

                      return (mutation.edges ?? [])
                        .filter(item => !item.guest)
                        .map(item => ({
                          key: item.id.toString(),
                          value: item.name,
                          valueWithFormatting: <GroupFormat group={item} />,
                        }));
                    } catch (_) {
                      toast.error(tCore('title'), {
                        description: tCore('internal_server_error'),
                      });

                      return [];
                    }
                  },
                }}
              />
            ),
          },
          {
            id: 'user',
            label: t('user'),
            component: props => (
              <AutoFormCombobox
                {...props}
                withFetcher={{
                  queryKey: 'Core_Members__Show__Search',
                  search: true,
                  queryFn: async ({ search }) => {
                    try {
                      const mutation = await getUsersShortApi({ search });

                      return (mutation.edges ?? []).map(item => ({
                        key: item.id.toString(),
                        value: item.name,
                        valueWithFormatting: (
                          <>
                            <AvatarUser sizeInRem={1.75} user={item} />
                            <div className="flex flex-col">
                              <span>{item.name}</span>
                              <GroupFormat
                                className="text-xs"
                                group={item.group}
                              />
                            </div>
                          </>
                        ),
                      }));
                    } catch (_) {
                      toast.error(tCore('title'), {
                        description: tCore('internal_server_error'),
                      });

                      return [];
                    }
                  },
                }}
              />
            ),
          },
          {
            id: 'unrestricted',
            component: AutoFormSwitch,
            label: t('unrestricted.title'),
            description: t('unrestricted.desc'),
          },
          {
            id: 'permissions',
            component: props => (
              <PermissionsField {...props} permissions={permissions} />
            ),
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
      />
    </>
  );
};
