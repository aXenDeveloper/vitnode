# Rules for Frontend

## Internationalization (next-intl) - i18n

Official docs: https://next-intl.dev/docs/usage

- Use `next-intl` for internationalization and localization,
- Languages keys should be added in `apps/web/src/plugins/core/langs/{lang}.ts` file first to avoid type errors,
- Use always this package for translations _(Don't left any plain text in the code)_,
