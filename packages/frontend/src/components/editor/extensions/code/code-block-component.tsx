'use client';

import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { CheckIcon, SortAscIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Button } from 'vitnode-frontend/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'vitnode-frontend/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'vitnode-frontend/components/ui/popover';
import { cn } from 'vitnode-frontend/helpers/classnames';

import { classNameCodeBlock } from './code';

export const CodeBlockComponent = ({
  extension,
  node: {
    attrs: { language: defaultLanguage },
  },
  updateAttributes,
}: {
  extension: {
    options: {
      lowlight: {
        listLanguages: () => string[];
      };
    };
  };
  node: { attrs: { language: string } };
  updateAttributes: (attrs: { language: string }) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(defaultLanguage);
  const t = useTranslations('core.global.editor.heading.code_block');
  const tCore = useTranslations('core.global');

  return (
    <NodeViewWrapper className="bg-muted relative rounded-md">
      <pre>
        <NodeViewContent
          as="code"
          className={classNameCodeBlock}
          style={{ whiteSpace: 'break-spaces' }}
        />
      </pre>

      <div className="border-muted-foreground/10 border-t p-2">
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <Button
              aria-expanded={open}
              className="w-40 justify-between"
              role="combobox"
              size="sm"
              variant="outline"
            >
              {value || t('auto')}
              <SortAscIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-40 p-0">
            <Command>
              <CommandInput className="h-9" placeholder={t('search')} />

              <CommandList>
                <CommandEmpty>{tCore('no_results')}</CommandEmpty>
                <CommandGroup>
                  {extension.options.lowlight.listLanguages().map(lang => (
                    <CommandItem
                      key={lang}
                      onSelect={currentValue => {
                        const val = currentValue === value ? '' : currentValue;
                        updateAttributes({ language: val });
                        setValue(val);
                        setOpen(false);
                      }}
                      value={lang}
                    >
                      {lang}
                      <CheckIcon
                        className={cn(
                          'ml-auto h-4 w-4',
                          value === lang ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </NodeViewWrapper>
  );
};
