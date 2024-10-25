import { UAParser } from 'ua-parser-js';

export const getUserAgentData = (userAgent: string) => {
  const user_parser = new UAParser(userAgent).getResult();

  return {
    user_agent: userAgent,
    uagent_browser: user_parser.browser.name ?? 'Uagent from tests',
    uagent_version: user_parser.browser.version ?? 'Uagent from tests',
    uagent_os: user_parser.os.name
      ? `${user_parser.os.name} ${user_parser.os.version}`
      : 'Uagent from tests',
  };
};
