import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { FileInput } from '@/components/ui/file-input';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@/components/ui/sidebar-server';
import { Slider } from '@/components/ui/slider';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ThemeEditorIds, useThemeEditor } from '../hooks/use-theme-editor';

export const LogosSidebarThemeEditorStyleAdmin = () => {
  const t = useTranslations('admin.core.styles.theme-editor.logos');
  const { form, iframeRef, updateLogo } = useThemeEditor();

  return (
    <Collapsible className="group/collapsible">
      <SidebarGroup className="px-3 py-0">
        <SidebarGroupLabel
          asChild
          className="group/label text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
        >
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              {t('title')}
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </Button>
          </CollapsibleTrigger>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent className="space-y-4 px-2 py-4">
            <FormField
              control={form.control}
              name="logos.text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('text')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={e => {
                        field.onChange(e);
                        const textElement =
                          iframeRef?.current?.contentWindow?.document.querySelector<HTMLElement>(
                            '#vitnode_logo_text',
                          );
                        if (!textElement) return;
                        textElement.textContent = e.target.value;
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logos.light"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('logo_light')}</FormLabel>
                  <FormControl>
                    <FileInput
                      id="logos.light"
                      {...field}
                      acceptExtensions={['png', 'jpg', 'jpeg', 'svg', 'webp']}
                      maxFileSizeInMb={2}
                      onChange={file => {
                        field.onChange(file);
                        updateLogo({ file, id: ThemeEditorIds.light });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logos.dark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('logo_dark')}</FormLabel>
                  <FormControl>
                    <FileInput
                      id="logos.dark"
                      {...field}
                      acceptExtensions={['png', 'jpg', 'jpeg', 'svg', 'webp']}
                      maxFileSizeInMb={2}
                      onChange={file => {
                        field.onChange(file);
                        updateLogo({ file, id: ThemeEditorIds.dark });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logos.width"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('width')}</FormLabel>
                  <FormControl>
                    <Slider
                      max={30}
                      min={1}
                      onValueChange={e => {
                        field.onChange(e[0]);
                        const logoElement =
                          iframeRef?.current?.contentWindow?.document.querySelector<HTMLElement>(
                            '#vitnode_logo',
                          );

                        logoElement?.style.setProperty(
                          '--logo-width',
                          `${e[0]}rem`,
                        );
                      }}
                      step={0.5}
                      value={[field.value]}
                    />
                  </FormControl>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {field.value}rem
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
};
