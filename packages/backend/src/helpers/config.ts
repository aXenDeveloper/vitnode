import * as fs from 'fs';
import { join } from 'path';
import { FileObj } from 'vitnode-shared/utils/files.dto';
import {
  AllowTypeFilesEnum,
  CaptchaTypeEnum,
} from 'vitnode-shared/utils/global';

export interface ConfigType {
  editor: {
    files: {
      allow_type: AllowTypeFilesEnum;
    };
    sticky: boolean;
  };
  last_updated: string;
  logos: {
    logo_dark?: FileObj;
    logo_light?: FileObj;
    mobile_logo_dark?: FileObj;
    mobile_logo_light?: FileObj;
    mobile_width: number;
    text: string;
    width: number;
  };
  restart_server: boolean;
  security: {
    captcha: {
      site_key: string;
      type: CaptchaTypeEnum;
    };
  };
  settings: {
    authorization: {
      force_login: boolean;
      lock_register: boolean;
      require_confirm_email: boolean;
    };
    email: {
      color_primary: string;
      color_primary_foreground: string;
      logo?: FileObj;
    };
    main: {
      contact_email: string;
      site_name: string;
      site_short_name: string;
    };
  };
}

export const DEFAULT_CONFIG_DATA: ConfigType = {
  last_updated: new Date().toISOString(),
  restart_server: false,
  logos: {
    text: 'VitNode',
    width: 10,
    mobile_width: 3,
  },
  security: {
    captcha: {
      type: CaptchaTypeEnum.none,
      site_key: '',
    },
  },
  editor: {
    sticky: true,
    files: {
      allow_type: AllowTypeFilesEnum.all,
    },
  },
  settings: {
    main: {
      site_name: 'VitNode',
      site_short_name: 'VitNode',
      contact_email: '',
    },
    email: {
      color_primary: 'hsl(220, 74%, 50%)',
      color_primary_foreground: 'hsl(210, 40%, 98%)',
    },
    authorization: {
      force_login: false,
      lock_register: false,
      require_confirm_email: false,
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
