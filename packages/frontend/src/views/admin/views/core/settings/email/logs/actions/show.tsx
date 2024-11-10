import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LogsEmailSettingsAdminObj } from 'vitnode-shared/admin/settings/email.dto';

export const ShowActionLogsEmailSettingsAdmin = ({
  subject,
  id,
  to,
  html,
  error,
}: LogsEmailSettingsAdminObj['edges'][0]) => {
  const t = useTranslations('admin.core.settings.email.logs.show');

  return (
    <Dialog>
      <TooltipWrapper content={t('title')}>
        <DialogTrigger asChild>
          <Button ariaLabel={t('title')} size="icon" variant="ghost">
            <Eye />
          </Button>
        </DialogTrigger>
      </TooltipWrapper>

      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {t('title_dialog', {
              id,
            })}
          </DialogTitle>
          <DialogDescription>
            {t.rich('to', {
              to,
              email: text => <span className="text-foreground">{text}</span>,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('subject')}</Label>

            <Input readOnly value={subject} />
          </div>

          <div className="space-y-2">
            <Label>{t('error')}</Label>

            <Textarea readOnly value={error} />
          </div>

          <div className="space-y-2">
            <Label>{t('html')}</Label>
            <Textarea readOnly value={html} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
