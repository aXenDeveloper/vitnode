# VitNode

- Always write and run unit tests in vitest for all new features and bug fixes.
- Don't use `React.FC` for defining React components. Instead, use the arrow function syntax.
- Don't use `any` type in TypeScript and use `unknown` as less as possible.
- Use `AutoForm` for forms instead of manually creating form components.
- After create/edit/delete operations, always refresh the data in the table to reflect the changes with notification using toast `sonner`.
- Use `React.lazy` and `Suspense` for code splitting and lazy loading for content-heavy dialogs like dialogs in forms.
