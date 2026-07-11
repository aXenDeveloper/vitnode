<p align="center">
  <a href="https://vitnode.com/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg">
      <img alt="VitNode Logo" src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg" width="250">
    </picture>
  </a>
</p>

# 🚀 VitNode

**VitNode** is an extendable framework for building modern applications with Next.js and Hono.js. It provides a structured, plugin-based architecture that makes development faster and less complex.

> [!NOTE]
> 🚧 You're viewing the `canary` branch (VitNode 2.0), which is under active development and may contain unstable code. For the stable version, check the `v1` branch.

## 🏁 Getting Started

### Supported Package Managers

- [bun](https://bun.com/) (min: v1.1, recommended: v1.3)
- [pnpm](https://pnpm.io/) (min: v10, recommended: v11)
- [node.js](https://nodejs.org/) (min: v22, recommended: v24)

### Quick Setup

1. **Install dependencies**

   ```bash
   pnpm create vitnode-app@canary
   // or
   bun create vitnode-app@canary
   // or
   npx create-vitnode-app@canary
   ```

2. **Start database container**

   ```bash
   pnpm docker:dev
   // or
   bun docker:dev
   // or
   npm run docker:dev
   ```

3. **Launch development server**
   ```bash
   pnpm dev
   // or
   bun dev
   // or
   npm run dev
   ```

## 📝 Available Scripts

- `pnpm dev` - Start development server with auto-reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Check code quality
- `pnpm lint:fix` - Fix code quality issues
- `pnpm db:migrate` - Run database migrations
- `pnpm dev:email` - Start email development server

## ✨ What's New in VitNode 2.0

- **Simplified Architecture**: Single-repo application structure (no monorepo)
- **Modern Backend**: Hono.js replaces NestJS for better performance
- **ESM-Only**: Full support for ECMAScript Modules
- **AI Integration**: New AI Rules and Multi-Cloud Provider support
- **Enhanced Plugin System**: Improved CLI tools for plugins
- **Better Documentation**: Completely rewritten docs and website
- **Streamlined Configuration**: Single config file for all settings
- **Zod 4**: Upgraded to the latest version for schema validation

## 🔍 Project Scope

VitNode provides:

- **Plugin Architecture**: Extend core functionality with custom plugins
- **Admin Control Panel**: Built-in management interface
- **Authentication System**: Support for credentials and SSO providers
- **Role-Based Access Control**: Comprehensive permission management
- **Internationalization**: Multi-language support out of the box
- **Theme System**: Light/dark mode with customizable components
- **API Documentation**: Auto-generated OpenAPI documentation

## 📊 Project Status

VitNode 2.0 is currently in **active development** (canary branch). While many features are functional, expect changes and improvements as we work toward a stable release.

> [!NOTE]
> 📚 Documentation is still in progress. Our website is under construction!

## 📄 License

MIT License
