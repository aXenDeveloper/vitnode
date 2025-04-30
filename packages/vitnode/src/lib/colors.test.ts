import { describe, expect, it } from 'vitest';

import {
  checkColorType,
  convertColor,
  getHSLFromString,
  getStringFromHSL,
  HslColor,
} from './colors';

describe('convertColor', () => {
  describe('hslToHex', () => {
    it('should convert HSL to hex correctly', () => {
      const hsl: HslColor = { h: 0, s: 100, l: 50 }; // Red
      expect(convertColor.hslToHex(hsl)).toBe('ff0000');

      const hsl2: HslColor = { h: 120, s: 100, l: 50 }; // Green
      expect(convertColor.hslToHex(hsl2)).toBe('00ff00');

      const hsl3: HslColor = { h: 240, s: 100, l: 50 }; // Blue
      expect(convertColor.hslToHex(hsl3)).toBe('0000ff');
    });
  });

  describe('hexToHSL', () => {
    it('should convert 6-digit hex to HSL correctly', () => {
      expect(convertColor.hexToHSL('#ff0000')).toEqual({ h: 0, s: 100, l: 50 });
      expect(convertColor.hexToHSL('#00ff00')).toEqual({
        h: 120,
        s: 100,
        l: 50,
      });
      expect(convertColor.hexToHSL('#0000ff')).toEqual({
        h: 240,
        s: 100,
        l: 50,
      });
    });

    it('should convert 3-digit hex to HSL correctly', () => {
      expect(convertColor.hexToHSL('#f00')).toEqual({ h: 0, s: 100, l: 50 });
      expect(convertColor.hexToHSL('#0f0')).toEqual({ h: 120, s: 100, l: 50 });
      expect(convertColor.hexToHSL('#00f')).toEqual({ h: 240, s: 100, l: 50 });
    });

    it('should return undefined for invalid hex values', () => {
      expect(convertColor.hexToHSL('#xyz')).toBeUndefined();
      expect(convertColor.hexToHSL('#12')).toBeUndefined();
      expect(convertColor.hexToHSL('invalid')).toBeUndefined();
    });
  });

  describe('RGBToHSL', () => {
    it('should convert RGB to HSL correctly', () => {
      expect(convertColor.RGBToHSL(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
      expect(convertColor.RGBToHSL(0, 255, 0)).toEqual({
        h: 120,
        s: 100,
        l: 50,
      });
      expect(convertColor.RGBToHSL(0, 0, 255)).toEqual({
        h: 240,
        s: 100,
        l: 50,
      });
      expect(convertColor.RGBToHSL(255, 255, 255)).toEqual({
        h: 0,
        s: 0,
        l: 100,
      });
      expect(convertColor.RGBToHSL(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
    });
  });

  describe('hslToRgb', () => {
    it('should convert HSL to RGB correctly', () => {
      expect(convertColor.hslToRgb(0, 100, 50)).toEqual({
        r: 'ff',
        g: '00',
        b: '00',
      });
      expect(convertColor.hslToRgb(120, 100, 50)).toEqual({
        r: '00',
        g: 'ff',
        b: '00',
      });
      expect(convertColor.hslToRgb(240, 100, 50)).toEqual({
        r: '00',
        g: '00',
        b: 'ff',
      });
    });
  });
});

describe('checkColorType', () => {
  it('should identify hex colors correctly', () => {
    expect(checkColorType('#fff')).toBe('hex');
    expect(checkColorType('#ffffff')).toBe('hex');
    expect(checkColorType('#FF0000')).toBe('hex');
  });

  it('should identify HSL colors correctly', () => {
    expect(checkColorType('hsl(0, 100%, 50%)')).toBe('hsl');
    expect(checkColorType('hsl(120, 60%, 70%)')).toBe('hsl');
  });

  it('should identify RGB colors correctly', () => {
    expect(checkColorType('rgb(255, 0, 0)')).toBe('rgb');
    expect(checkColorType('rgb(255 0 0)')).toBe('rgb');
  });

  it('should return null for invalid colors', () => {
    expect(checkColorType('invalid')).toBeNull();
    expect(checkColorType('rgb(300, 0, 0)')).toBeNull();
    expect(checkColorType('hsl(400, 100%, 50%)')).toBeNull();
  });
});

describe('getHSLFromString', () => {
  it('should parse valid HSL strings correctly', () => {
    expect(getHSLFromString('hsl(0, 100%, 50%)')).toEqual({
      h: 0,
      s: 100,
      l: 50,
    });
    expect(getHSLFromString('hsl(120, 60%, 70%)')).toEqual({
      h: 120,
      s: 60,
      l: 70,
    });
  });

  it('should return null for invalid HSL strings', () => {
    expect(getHSLFromString('invalid')).toBeNull();
    expect(getHSLFromString('rgb(255, 0, 0)')).toBeNull();
    expect(getHSLFromString('hsl(400, 100%, 50%')).toBeNull();
  });
});

describe('getStringFromHSL', () => {
  it('should format HSL color object to string correctly', () => {
    expect(getStringFromHSL({ h: 0, s: 100, l: 50 })).toBe('hsl(0, 100%, 50%)');
    expect(getStringFromHSL({ h: 120, s: 60, l: 70 })).toBe(
      'hsl(120, 60%, 70%)',
    );
    expect(getStringFromHSL({ h: 240, s: 50, l: 30 })).toBe(
      'hsl(240, 50%, 30%)',
    );
  });
});
