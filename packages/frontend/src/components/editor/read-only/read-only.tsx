import { CONFIG } from '@/helpers/config-with-env';
import { generateHTML } from '@tiptap/html';
import { JSONContent } from '@tiptap/react';
import parse, { Element, HTMLReactParserOptions } from 'html-react-parser';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { cn } from '../../../helpers/classnames';
import { useExtensionsEditor } from '../extensions/extensions';
import { changeCodeBlock } from './code-block';
import { FileDownloadButton } from './file-download-button';

export const ReadOnlyEditor = ({
  allowDownloadAttachments,
  className,
  value,
}: {
  allowDownloadAttachments?: boolean;
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
              height={+domNode.attribs.width}
              src={src}
              width={+domNode.attribs.height}
            />
          </span>
        );
      }

      // if (name === 'pre' && children.length > 0) {
      //   return changeCodeBlock(domNode);
      // }

      if (name === 'button' && domNode.attribs['data-type'] === 'fileNode') {
        return (
          <FileDownloadButton
            allowDownloadAttachments={allowDownloadAttachments}
            dir_folder={domNode.attribs.dir_folder}
            file_alt={domNode.attribs.file_alt}
            file_name={domNode.attribs.file_name}
            file_name_original={domNode.attribs.file_name_original}
            file_size={parseInt(domNode.attribs.file_size, 10)}
            height={+domNode.attribs.height}
            id={+domNode.attribs.id}
            mimetype={domNode.attribs.mimetype}
            security_key={domNode.attribs.security_key}
            width={+domNode.attribs.width}
          />
        );
      }
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
