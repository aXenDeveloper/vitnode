import { exec } from 'child_process';

export const execShellCommand = async (cmd: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      const result = stdout ? stdout : stderr;

      resolve(result);
    });
  });
};
