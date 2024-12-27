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

Open-source full-stack framework build on top of [Next.js](https://nextjs.org/), [Nest.js](https://nestjs.com/), and [PostgreSQL](https://www.postgresql.org/) with Admin Control Panel (AdminCP), Plugins System, Internationalization (i18n), and more.

## 🚀 Features

- **💸 Free & Open Source**: VitNode is free to use and open-source, so you can build your applications without any restrictions.
- **💡 Admin Control Panel (AdminCP)**: Take control of your app with tools to manage users, groups, plugins, and navigation, all through an intuitive interface.
- **🔌 Plugin System**: Extend the functionality of your application with custom plugins that can be shared with the community.
- **🌍 Multilingual Support**: Build applications that support multiple languages with ease including routing, inputs, and translations.
- **📧 Email System**: Leverage dynamic React-based templates for transactional emails, complete with multilingual support and integration with providers like SMTP and Resend.
- **🚀 Accelerate Development**: Reduce development time with prebuilt features like WYSIWYG editors, auto-generated forms, and built-in API helpers like pagination, upload files and more.
- **🔒 Secure by Default**: Protect your application with built-in security features like CSRF protection, rate limiting, CAPTCHA, user-groups and more.

## 📚 Documentation

Check out the [VitNode Documentation](https://vitnode.com/docs) for more information on how to get started, how to deploy app, how to create plugins, and more.

## 📦 Installation

### 1. Pre-Installation

Download and install [Node.js](https://nodejs.org/) and [Docker](https://www.docker.com/).

### 2. Create a new project

```bash
 npx create-vitnode-app@latest
```

### 3. Start docker-compose for dev

```bash
npm run docker:dev
```

### 4. Start the development server

```bash
 npm run dev
```

## 🔎 Screenshots

<img src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/screenshots/1.png" alt="Login page" />
<img src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/screenshots/2.png" alt="Devices manager in user settings" />
<img src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/screenshots/3.png" alt="Dashboard in Admin Control Panel" />
<img src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/screenshots/4.png" alt="Plugins table in Admin Control Panel" />
<img src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/screenshots/5.png" alt="Theme Editor in Admin Control Panel" />
<img src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/screenshots/6.png" alt="Metadata settings in Admin Control Panel" />
<img src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/screenshots/7.png" alt="Search engine in Admin Control Panel" />

## ⚠️ Requirements

| 🛠️ Software | Minimum | Recommended |
| :---------- | :------ | :---------- |
| Node.js     | 20      | 22          |
| PostgreSQL  | 14      | 16          |

| 🖥️ Hardware | Minimum        | Recommended    |
| :---------- | :------------- | :------------- |
| CPU         | 1GHz (2+ core) | 1GHz (4+ core) |
| RAM         | 2GB            | 8GB            |
| Storage     | 10GB           | 20GB           |
| Network     | 100Mbps        | 100Mbps        |

| 🧑‍💻 Browser | Minimum | Recommended |
| :--------- | :------ | :---------- |
| Chrome     | >= 106  | >= 115      |
| Firefox    | >= 110  | >= 121      |
| Edge       | >= 106  | >= 120      |
| Safari     | >= 16   | >= 17.2     |
| Opera      | >= 94   | >= 101      |
