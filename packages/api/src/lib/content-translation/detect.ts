import { francAll } from "franc-min";

import {
  stripUntranslatable,
  textWords,
} from "../../content/auto-translate/text";

/** Bumped when detection changes, so memoized results are recomputed. */
export const LANGUAGE_DETECTOR_VERSION = 1;

const ISO_639_3: Readonly<Record<string, string>> = {
  arb: "ar",
  bul: "bg",
  ces: "cs",
  cmn: "zh",
  dan: "da",
  deu: "de",
  ell: "el",
  eng: "en",
  fin: "fi",
  fra: "fr",
  heb: "he",
  hin: "hi",
  hrv: "hr",
  hun: "hu",
  ind: "id",
  ita: "it",
  jpn: "ja",
  kor: "ko",
  lit: "lt",
  nld: "nl",
  nob: "nb",
  pol: "pl",
  por: "pt",
  ron: "ro",
  rus: "ru",
  slk: "sk",
  slv: "sl",
  spa: "es",
  srp: "sr",
  swe: "sv",
  tha: "th",
  tur: "tr",
  ukr: "uk",
  vie: "vi",
};

const SHORT_TEXT_LEXICONS: Readonly<Record<string, ReadonlySet<string>>> = {
  de: new Set(
    "aber alle als also am an auch auf aus bei bin bis bitte da danke das dass dem den der des die dieser doch du durch ein eine einen er es etwas für gibt gut habe haben hallo hat heute ich ihr im immer in ist ja jetzt kann kein mal mehr mein mich mir mit nach nicht noch nur oder schon sehr sein sich sie sind so über um und uns von vor war was weil wenn wie wir wird zu zum zur".split(
      " ",
    ),
  ),
  en: new Set(
    "a about after again all also always am an and any are as at back be because been before being best broke but by can could day did do does doesn't don't done each even every everyone fix fixed for from get gets good great had has have he hello help her here hi his how i i'm idea if in into is isn't it it's its just know last let like looks lot make many me more most my need never new no not now of on one only or other our out over people please problem really same see she should so some still such sure thank thanks that the their them then there these they thing think this those through time to today too try up update us use very want was way we well were what when where which who why will with work works would wrong yes yet you your".split(
      " ",
    ),
  ),
  es: new Set(
    "a al algo bien bueno como con cuando de del donde el ella en era es esta este esto estoy gracias hay hola la las le lo los más me mi muy no nos para pero por porque que se si sin sobre su también tengo todo un una y ya yo".split(
      " ",
    ),
  ),
  fr: new Set(
    "à au aussi avec avoir bien bon bonjour c'est ce cela ces cette comme dans de des du elle en est et être il ils je la le les leur mais merci moi mon ne nous on ou où par pas plus pour qu'il que qui sa se ses son sont sur très tu un une vous".split(
      " ",
    ),
  ),
  it: new Set(
    "a al anche che ci come con da del della di e è grazie gli ha ho il in io la le lo ma mi molto ne non per più questo se si sono su tu un una uno".split(
      " ",
    ),
  ),
  nl: new Set(
    "aan al bij dan dank dat de die dit een en er geen goed heb het hij hoe ik in is je kan maar met mijn niet nog nu of ook op te van voor was wat we wel wij zijn".split(
      " ",
    ),
  ),
  pl: new Set(
    "a ale bardzo bez był była było będzie co czy dla do dobry dobrze dzień dzięki dziękuję gdy gdzie go i ich ile jak jakie jest jestem jeszcze już kiedy kto który która które ma mam mamy mi może można mnie mój na nam nas nawet nic nie nim no o od on ona oni po pod pomysł pomysłem problem przez przy się są ta tak tam te tego tej ten to tu tylko tym w we wersja wiem więc wszystko wszystkim z za że żeby świetny super".split(
      " ",
    ),
  ),
  pt: new Set(
    "a ao com como da das de do dos e é ela ele em então essa esse está eu isso já mais mas me meu muito na não no nos o obrigado os para pela pelo por que se sem seu sim sua também tem um uma você".split(
      " ",
    ),
  ),
};

const MARKERS: readonly (readonly [string, RegExp])[] = [
  ["pl", /[ąćęłńśźż]/iu],
  ["de", /[äöüß]/iu],
  ["es", /[ñ¿¡]/iu],
  ["pt", /[ãõ]/iu],
  ["fr", /[èêëçœù]/iu],
];

const LONG_TEXT_LETTERS = 40;

/** What the detector concluded about one text. */
export interface LanguageDetection {
  /** Whether the result is reliable enough to act on without asking. */
  confident: boolean;
  /** The site language code (`en`, `pl`, ...), or `null` when none fits. */
  locale: null | string;
}

/** The primary subtag of a language code: `pt-BR` → `pt`. */
export const primaryLocale = (locale: string): string =>
  locale.split("-")[0].toLowerCase();

const lexiconScores = (text: string): [string, number][] => {
  const words = textWords(text);
  const scores = new Map<string, number>();
  for (const [locale, lexicon] of Object.entries(SHORT_TEXT_LEXICONS)) {
    const hits = words.filter(word => lexicon.has(word)).length;
    if (hits > 0) scores.set(locale, hits);
  }
  for (const [locale, marker] of MARKERS) {
    if (marker.test(text)) scores.set(locale, (scores.get(locale) ?? 0) + 2);
  }

  return [...scores].sort((a, b) => b[1] - a[1]);
};

/**
 * Detects the language of plain text without any AI: trigram statistics for
 * longer text, frequent words and letters for short text. Pure JavaScript, so
 * it runs on every supported runtime. A result is `confident` only when the
 * signals clearly favor one language.
 */
export const detectLanguage = (source: string): LanguageDetection => {
  const text = stripUntranslatable(source);
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return { confident: false, locale: null };

  const ranked = francAll(text, { minLength: 3 });
  const [top, second] = ranked;
  const francLocale =
    top && top[0] !== "und" ? (ISO_639_3[top[0]] ?? null) : null;
  const francMargin = top && second ? top[1] - second[1] : 0;
  const [best, runnerUp] = lexiconScores(text);
  const lexiconLocale = best ? best[0] : null;

  if (letters >= LONG_TEXT_LETTERS && francLocale) {
    return {
      confident: francMargin >= 0.03 || francLocale === lexiconLocale,
      locale: francLocale,
    };
  }

  if (best) {
    const clear = best[1] >= 2 && best[1] >= 2 * (runnerUp?.[1] ?? 0);

    return {
      confident: clear || (best[1] >= 1 && lexiconLocale === francLocale),
      locale: lexiconLocale,
    };
  }

  return { confident: false, locale: francLocale };
};
