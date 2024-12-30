import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LogsAdminObj } from 'vitnode-shared/admin/logs.dto';

export const MoreActionsLogsDiagnosticTools = ({
  name,
  method,
  url,
  created_at,
  headers,
  message,
}: LogsAdminObj) => {
  const t = useTranslations('admin.core.diagnostic.error_logs');

  return (
    <Sheet>
      <TooltipWrapper content={t('more_info')}>
        <SheetTrigger asChild>
          <Button ariaLabel={t('more_info')} size="icon" variant="ghost">
            <SearchIcon />
          </Button>
        </SheetTrigger>
      </TooltipWrapper>

      <SheetContent>
        <SheetHeader>
          <SheetTitle>{name}</SheetTitle>
          <SheetDescription>
            <DateFormat date={created_at} />
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="h-6">{method}</Badge> {url}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">{t('message')}</Label>
            <Textarea
              className="min-h-64"
              defaultValue={message}
              id="message"
              readOnly
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="headers">{t('headers')}</Label>
            <Textarea
              className="min-h-64"
              defaultValue={headers}
              id="headers"
              readOnly
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
