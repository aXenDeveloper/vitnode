import { usePathname, useRouter } from '@/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import React from 'react';
import { PaginationInfo } from 'vitnode-shared/utils/pagination.dto';

import { Button } from './button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { TooltipWrapper } from './tooltip';

const PAGE_SIZES = [10, 20, 30, 40, 50];

export const Pagination = ({
  pageInfo,
  defaultPageSize = 10,
}: {
  defaultPageSize?: 10 | 20 | 30 | 40 | 50;
  pageInfo: PaginationInfo;
}) => {
  const t = useTranslations('core.global');
  const { push } = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pagination = React.useMemo(
    () => ({
      first: searchParams.get('first'),
      last: searchParams.get('last'),
      cursor: searchParams.get('cursor'),
    }),
    [searchParams],
  );
  const pageSizeValue: number = React.useMemo(() => {
    if (PAGE_SIZES.includes(Number(pagination.first))) {
      return Number(pagination.first);
    }

    if (PAGE_SIZES.includes(Number(pagination.last))) {
      return Number(pagination.last);
    }

    return defaultPageSize;
  }, [pagination, defaultPageSize]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
      <span className="text-muted-foreground text-sm">
        {t('total_count', { count: pageInfo.total_count })}
      </span>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Select
          onValueChange={value => {
            const params = new URLSearchParams(searchParams.toString());
            if (params.has('last')) {
              params.set('last', value);
              params.delete('first');
            } else {
              params.set('first', value);
              params.delete('last');
            }
            push(`${pathname}?${params.toString()}`, {
              scroll: false,
            });
          }}
          value={`${pageSizeValue}`}
        >
          <TooltipWrapper content={t('rows_per_page')}>
            <SelectTrigger className="bg-card h-8 w-[70px]">
              <SelectValue placeholder={pageSizeValue} />
            </SelectTrigger>
          </TooltipWrapper>
          <SelectContent side="top">
            {PAGE_SIZES.map(pageSize => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center space-x-2">
          <Button
            ariaLabel={t('previous')}
            className="bg-card"
            disabled={!pageInfo.has_previous_page}
            onClick={() => {
              if (!pageInfo.start_cursor) return;

              const params = new URLSearchParams(searchParams.toString());
              params.set('cursor', `${pageInfo.start_cursor}`);
              params.set('last', `${pageSizeValue}`);
              params.delete('first');
              push(`${pathname}?${params.toString()}`, {
                scroll: false,
              });
            }}
            size="icon"
            variant="outline"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            ariaLabel={t('next')}
            className="bg-card"
            disabled={!pageInfo.has_next_page}
            onClick={() => {
              if (!pageInfo.end_cursor) return;

              const params = new URLSearchParams(searchParams.toString());
              params.set('cursor', `${pageInfo.end_cursor}`);
              params.set('first', `${pageSizeValue}`);
              params.delete('last');
              push(`${pathname}?${params.toString()}`, {
                scroll: false,
              });
            }}
            size="icon"
            variant="outline"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
