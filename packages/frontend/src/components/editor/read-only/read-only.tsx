import { CONFIG } from '@/helpers/config-with-env';
import { generateHTML } from '@tiptap/html';
import { JSONContent } from '@tiptap/react';
import parse, { Element, HTMLReactParserOptions } from 'html-react-parser';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { cn } from '../../../helpers/classnames';
import { useExtensionsEditor } from '../extensions/extensions';
import { changeCodeBlock } from './code-block';

export const ReadOnlyEditor = ({
  className,
  value,
}: {
  className?: string;
  value: StringLanguage[];
}) => {
  const locale = useLocale();
  const extensions = useExtensionsEditor({});

  const currentValue = (): string => {
    const current =
      value.find(item => item.language_code === locale)?.value ?? '';

    if (current) {
      return current;
    }

    const currentEnglish = value.find(
      item => item.language_code === 'en',
    )?.value;

    if (currentEnglish) {
      return currentEnglish;
    }

    if (value.length > 0) {
      return value[0].value;
    }

    return '';
  };

  const getText = (): string => {
    try {
      const json: JSONContent = JSON.parse(currentValue());

      return generateHTML(json, extensions);
    } catch (_) {
      return currentValue();
    }
  };

  const options: HTMLReactParserOptions = {
    replace: domNode => {
      if (!(domNode instanceof Element && domNode.attribs)) {
        return;
      }

      const { children, name } = domNode;

      if (
        name === 'button' &&
        domNode.attribs['data-type'] === 'fileNode' &&
        domNode.attribs.width &&
        domNode.attribs.height
      ) {
        const src = `${CONFIG.backend_public_url}/${domNode.attribs.dir_folder}/${domNode.attribs.file_name}`;

        return (
          <span className="inline-block">
            <Image
              alt=""
              // className="inline-block"
              height={+domNode.attribs.height}
              src={src}
              width={+domNode.attribs.width}
            />
          </span>
        );
      }

      // if (name === 'pre' && children.length > 0) {
      //   return changeCodeBlock(domNode);
      // }
    },
  };

  return (
    <div
      className={cn(
        'break-words [&>*:not(:last-child)]:mb-[0.5rem]',
        className,
      )}
    >
      {parse(getText(), options)}
    </div>
  );
};
