import { highlight } from 'fumadocs-core/highlight';
import {
  CodeBlock as BaseCodeBlock,
  type CodeBlockProps as BaseCodeBlockProps,
  Pre,
} from 'fumadocs-ui/components/codeblock';

export interface CodeBlockProps {
  code: string;
  lang: string;
  wrapper?: BaseCodeBlockProps;
}

export async function CodeBlock({ code, lang, wrapper }: CodeBlockProps) {
  const rendered = await highlight(code, {
    lang,
    themes: {
      light: 'github-light',
      dark: 'vesper',
    },
    components: {
      pre: Pre,
    },
  });

  return <BaseCodeBlock {...wrapper}>{rendered}</BaseCodeBlock>;
}
