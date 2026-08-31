<p align="center">
  <br>
  <a href="https://vitnode.com/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg">
      <img alt="VitNode Logo" src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg" width="400">
    </picture>
  </a>
  <br>
  <br>
</p>

# VitNode App

This is a basic template for a [VitNode](https://vitnode.com/) app.

## Getting Started

### 1. Install dependencies

```bash
{{INSTALL}}
```

### 2. Create your `.env`

Every app in this project ships a `.env.example`. Copy each one to `.env` beside
it — in development the values as they come are the ones the bundled Postgres
uses, so you can paste them unchanged:

```bash
{{ENV_COPY}}
```

### 3. Start a database

Any Postgres will do. {{DATABASE}}

### 4. Start the development server

```bash
{{DEV}}
```

Open {{START_URLS}} with your browser to see the result.

The first start migrates the database for you: `{{DEV}}` runs
`vitnode db:prepare` before anything serves a request, which applies every
pending migration and seeds the roles, languages and permissions a VitNode
installation needs. It is safe to run again — every step is idempotent, and the
database itself is what decides whether there is work to do.

## Useful commands

| Command | What it does |
| ------- | ------------ |
{{COMMANDS}}

Read more in the [VitNode documentation](https://vitnode.com/docs/dev).
