import { BundledLanguage, getSingletonHighlighter } from 'shiki';

export const languagesSupportShiki: BundledLanguage[] = [
  'apache',
  'astro',
  'applescript',
  'bash',
  'c',
  'c#',
  'c++',
  'cmd',
  'cobol',
  'cs',
  'css',
  'dart',
  'diff',
  'docker',
  'dockerfile',
  'dotenv',
  'git-commit',
  'git-rebase',
  'gql',
  'graphql',
  'html',
  'http',
  'java',
  'typescript',
  'javascript',
  'json',
  'kotlin',
  'lua',
  'makefile',
  'markdown',
  'mdx',
  'nginx',
  'objective-c',
  'pascal',
  'perl',
  'php',
  'python',
  'ruby',
  'rust',
  'sass',
  'scss',
  'shell',
  'svelte',
  'swift',
  'sql',
  'regexp',
  'yaml',
  'xml',
];

export const shikiParser = async (text: string, lang?: string) => {
  const highlighter = await getSingletonHighlighter({
    themes: ['min-dark', 'min-light'],
    langs: languagesSupportShiki,
  });

  const out = highlighter.codeToHtml(text, {
    lang: lang ?? 'plaintext',
    themes: { dark: 'min-dark', light: 'min-light' },
    defaultColor: false,
    transformers: [
      {
        name: 'rehype-code:pre-process',
        line(hast) {
          if (hast.children.length > 0) return;
          hast.children.push({
            type: 'text',
            value: ' ',
          });
        },
      },
    ],
  });

  return out;
};
