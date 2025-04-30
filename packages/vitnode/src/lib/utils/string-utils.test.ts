import { describe, expect, it } from 'vitest';

import { capitalizeFirstLetter, truncateString } from './string-utils';

describe('String Utilities', () => {
  describe('capitalizeFirstLetter', () => {
    it('should capitalize the first letter of a string', () => {
      expect(capitalizeFirstLetter('hello')).toBe('Hello');
      expect(capitalizeFirstLetter('world')).toBe('World');
    });

    it('should handle empty strings', () => {
      expect(capitalizeFirstLetter('')).toBe('');
    });

    it('should handle null or undefined values', () => {
      // @ts-expect-error Testing null input
      expect(capitalizeFirstLetter(null)).toBe(null);
      // @ts-expect-error Testing undefined input
      expect(capitalizeFirstLetter(undefined)).toBe(undefined);
    });

    it('should not modify already capitalized strings', () => {
      expect(capitalizeFirstLetter('Hello')).toBe('Hello');
      expect(capitalizeFirstLetter('WORLD')).toBe('WORLD');
    });

    it('should work with single character strings', () => {
      expect(capitalizeFirstLetter('a')).toBe('A');
      expect(capitalizeFirstLetter('z')).toBe('Z');
    });
  });

  describe('truncateString', () => {
    it('should truncate strings longer than maxLength', () => {
      expect(truncateString('Hello, world!', 5)).toBe('Hello...');
      expect(truncateString('Testing truncation', 7)).toBe('Testing...');
    });

    it('should not modify strings shorter than or equal to maxLength', () => {
      expect(truncateString('Short', 5)).toBe('Short');
      expect(truncateString('Test', 10)).toBe('Test');
    });

    it('should handle empty strings', () => {
      expect(truncateString('', 5)).toBe('');
    });

    it('should handle null or undefined values', () => {
      // @ts-expect-error Testing null input
      expect(truncateString(null, 5)).toBe(null);
      // @ts-expect-error Testing undefined input
      expect(truncateString(undefined, 5)).toBe(undefined);
    });

    it('should allow custom suffix', () => {
      expect(truncateString('Hello, world!', 5, ' [more]')).toBe(
        'Hello [more]',
      );
      expect(truncateString('Testing truncation', 7, '..read more')).toBe(
        'Testing..read more',
      );
    });
  });
});
