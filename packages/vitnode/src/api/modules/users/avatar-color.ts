import { convertColor } from '@/lib/colors';

const getHashOfString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  return hash;
};

const normalizeHash = (hash: number, min: number, max: number) => {
  return Math.floor((hash % (max - min)) + min);
};

const generateHSLFromName = (name: string) => {
  const hRange = [0, 360];
  const lRange = [25, 60];
  const sRange = [50, 75];

  const hash = getHashOfString(name);
  const h = normalizeHash(hash, hRange[0], hRange[1]);
  const s = normalizeHash(hash, sRange[0], sRange[1]);
  const l = normalizeHash(hash, lRange[0], lRange[1]);

  return [h, s, l];
};

export const generateAvatarColor = (name: string): string => {
  const hslName = generateHSLFromName(name);

  return convertColor.hslToHex({
    h: hslName[0],
    s: hslName[1],
    l: hslName[2],
  });
};
