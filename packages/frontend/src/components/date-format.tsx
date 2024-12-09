'use client';

import { useDateFormat } from '@/hooks/use-date-format';
import React from 'react';

import { TooltipWrapper } from './ui/tooltip';

export const DateFormat = ({
  className,
  date,
  ref,
  showFullDate,
}: {
  className?: string;
  date: Date;
  ref?: React.RefCallback<HTMLTimeElement>;
  showFullDate?: boolean;
}) => {
  const { now, fullDate, getDate } = useDateFormat({
    date,
  });

  if (now.getFullYear() == new Date().getFullYear() && !showFullDate) {
    return (
      <TooltipWrapper content={fullDate}>
        <time className={className} dateTime={fullDate.toString()} ref={ref}>
          {getDate()}
        </time>
      </TooltipWrapper>
    );
  }

  return (
    <time className={className} dateTime={fullDate.toString()} ref={ref}>
      {fullDate}
    </time>
  );
};
