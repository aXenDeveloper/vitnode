const ALLOWED_VERSION_TYPES = ['major', 'minor', 'patch'];
const WORKSPACE = process.env.GITHUB_WORKSPACE || process.cwd();
const GIT_USER = {
  NAME: process.env.GITHUB_USER ?? 'Automated Version Bump',
  EMAIL: process.env.GITHUB_EMAIL
    ? `${process.env.GITHUB_USER}@users.noreply.github.com`
    : 'gh-action-bump-version@users.noreply.github.com',
};

const init = () => {
  console.log(
    'Initializing build version script...',
    GIT_USER.EMAIL,
    GIT_USER.NAME,
  );
};

init();
