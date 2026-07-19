#!/bin/sh
# Registers the `polish` text-search configuration (backed by the baked-in
# hunspell dictionary) on a fresh data dir. Created in template1 as well so any
# database created afterwards (e.g. the app DB) inherits it.
set -e

for db in template1 "${POSTGRES_DB:-postgres}"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<'SQL'
CREATE TEXT SEARCH DICTIONARY polish_hunspell (
  TEMPLATE = ispell,
  DictFile = pl_pl,
  AffFile = pl_pl
);
CREATE TEXT SEARCH CONFIGURATION polish (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION polish
  ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
  WITH polish_hunspell, simple;
SQL
done
