import type { BundledLanguage, BundledTheme, Highlighter } from 'shiki';

import { bundledLanguages, bundledThemes, createHighlighter } from 'shiki';

import { languagesSupportShiki } from './shiki-parser';

let highlighter: Highlighter | undefined;
let highlighterPromise: Promise<void> | undefined;
const loadingLanguages = new Set<BundledLanguage>();
const loadingThemes = new Set<BundledTheme>();

export function resetHighlighter() {
  highlighter = undefined;
  highlighterPromise = undefined;
  loadingLanguages.clear();
  loadingThemes.clear();
}

export function getShiki() {
  return highlighter;
}

/**
 * Load the highlighter. Makes sure the highlighter is only loaded once.
 */
export async function loadHighlighter() {
  if (!highlighter && !highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['min-dark', 'min-light'],
      langs: languagesSupportShiki,
    }).then(h => {
      highlighter = h;
    });

    return highlighterPromise;
  }

  if (highlighterPromise) {
    return highlighterPromise;
  }
}

/**
 * Loads a theme if it's valid and not yet loaded.
 * @returns true or false depending on if it got loaded.
 */
export async function loadTheme(theme: BundledTheme) {
  if (
    highlighter &&
    !highlighter.getLoadedThemes().includes(theme) &&
    !loadingThemes.has(theme) &&
    theme in bundledThemes
  ) {
    loadingThemes.add(theme);
    await highlighter.loadTheme(theme);
    loadingThemes.delete(theme);

    return true;
  }

  return false;
}

/**
 * Loads a language if it's valid and not yet loaded
 * @returns true or false depending on if it got loaded.
 */
export async function loadLanguage(language: BundledLanguage) {
  if (
    highlighter &&
    !highlighter.getLoadedLanguages().includes(language) &&
    !loadingLanguages.has(language) &&
    language in bundledLanguages
  ) {
    loadingLanguages.add(language);
    await highlighter.loadLanguage(language);
    loadingLanguages.delete(language);

    return true;
  }

  return false;
}

/**
 * Initializes the highlighter based on the prosemirror document,
 * with the themes and languages in the document.
 */
export async function initHighlighter() {
  const loader = loadHighlighter();
  await loader;
}
