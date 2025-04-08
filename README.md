<p align="center">
  <a href="https://vitnode.com/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg">
      <img alt="VitNode Logo" src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg" width="250">
    </picture>
  </a>
</p>

# VitNode

Extendable framework for building applications with Next.js and Hono.js.

> [!WARNING]
> You are in `canary` branch where is VitNode 2.0. This is the development branch and may contain unstable code.

> [!NOTE]
> If you are looking for the `v1` version of VitNode, please check the `v1` branch.

## 📚 Documentation

> [!NOTE]
> The documentation is still in progress. Our page is under construction :)

## ⚠️ Requirements

| 🛠️ Software | Minimum | Recommended |
| :---------- | :------ | :---------- |
| Node.js     | 20      | 22          |
| PostgreSQL  | 14      | 16          |

## 📦 Installation VitNode Dev

### 1. Pre-Installation

Download and install the following software:

- [Node.js](https://nodejs.org/),
- [Docker](https://www.docker.com/),
- [pnpm](https://pnpm.io/).

### 2. Install packages

```bash
pnpm install
```

### 3. Start database container

```bash
pnpm docker:dev
```

### 4. Start VitNode

```bash
pnpm dev
```
