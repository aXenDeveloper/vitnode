import * as fs from 'fs';
import { join } from 'path';
import { CaptchaTypeEnum } from 'vitnode-shared/utils/global';

export interface ConfigType {
  security: {
    captcha: {
      site_key: string;
      type: CaptchaTypeEnum;
    };
  };
}

export const DEFAULT_CONFIG_DATA: ConfigType = {
  security: {
    captcha: {
      type: CaptchaTypeEnum.none,
      site_key: '',
    },
  },
};

export const configPath = join(
  process.cwd(),
  'src',
  'plugins',
  'core',
  'utils',
  'config.json',
);

export const getConfigFile = () => {
  const file = fs.readFileSync(configPath, 'utf-8');

  return JSON.parse(file) as ConfigType;
};

export const updateConfigFile = (config: ConfigType) => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
};
