import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const getTranslationForEmail = (
  namespaces: string,
  language: string,
): ((key: string) => string) => {
  const resolveNamespace = namespaces.split('.');
  let path = join(
    process.cwd(),
    '..',
    'frontend',
    'src',
    'plugins',
    resolveNamespace[0],
    'langs',
    `${language}.json`,
  );

  if (!existsSync(path)) {
    path = join(
      process.cwd(),
      '..',
      'frontend',
      'src',
      'plugins',
      resolveNamespace[0],
      'langs',
      'en.json',
    );
  }

  const messages = JSON.parse(readFileSync(path, 'utf-8'));

  return (key: string) => {
    let message = messages;

    [...resolveNamespace, ...key.split('.')].forEach(part => {
      try {
        const next = message[part as never];

        if (!part || next === null) {
          return key;
        }

        message = next;
      } catch (_) {
        return key;
      }
    });

    return message;
  };
};
