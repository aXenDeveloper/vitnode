# VitNode dev Postgres with Polish full-text search.
# The stock postgres image ships no `polish` text-search configuration, so we
# bake the hunspell Polish dictionary (UTF-8) into `tsearch_data` and register
# the `polish` configuration on first init (see initdb/10-polish-fts.sh).
FROM postgres:17.5-alpine

# Vendored UTF-8 hunspell Polish dictionary (converted from the LibreOffice /
# sjp.pl ISO-8859-2 sources), gzipped to keep the repo lean.
COPY tsearch_data/pl_pl.dict.gz tsearch_data/pl_pl.affix.gz /tmp/pl/

RUN set -eux; \
    tsdir="$(pg_config --sharedir)/tsearch_data"; \
    gunzip -c /tmp/pl/pl_pl.dict.gz  > "$tsdir/pl_pl.dict"; \
    gunzip -c /tmp/pl/pl_pl.affix.gz > "$tsdir/pl_pl.affix"; \
    rm -rf /tmp/pl

COPY initdb/10-polish-fts.sh /docker-entrypoint-initdb.d/
