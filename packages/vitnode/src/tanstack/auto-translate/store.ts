import type {
  AutoTranslateFieldResult,
  AutoTranslateResponse,
} from "@vitnode/api/content/auto-translate";

import type { AutoTranslateItemRequest } from "./query";

export const autoTranslateItemKey = (
  contentTypeId: string,
  id: number | string,
) => `${contentTypeId}\u0000${String(id)}`;

const fieldKey = (
  locale: string,
  item: string,
  field: string,
  fingerprint: string,
) => `${locale}\u0000${item}\u0000${field}\u0000${fingerprint}`;

/**
 * What one page knows about translations: results keyed by language, record,
 * field and the fingerprint of the text the page renders, plus the reader's
 * per-item choices. A result is only ever stored under the fingerprint the
 * page asked about, so a reply that was edited, a late answer for the
 * previous language, or a response for an older version can never be shown
 * for the current text. Framework-free, so it is tested without React.
 */
export class AutoTranslateStore {
  private readonly listeners = new Set<() => void>();
  private readonly manual = new Set<string>();
  private readonly requested = new Set<string>();
  private readonly results = new Map<string, AutoTranslateFieldResult>();
  private readonly showingOriginal = new Set<string>();
  private version = 0;

  readonly getVersion = () => this.version;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  /**
   * The fields of `target` that have no answer yet (or only "missing") and
   * were never sent, marked as sent. What an automatic request should carry
   * for it.
   */
  claimMissing(
    locale: string,
    target: AutoTranslateItemRequest,
  ): AutoTranslateItemRequest | null {
    const key = autoTranslateItemKey(target.contentTypeId, target.id);
    const fields = target.fields.filter(field => {
      const id = fieldKey(locale, key, field.name, field.fingerprint);
      const known = this.results.get(id);

      return (
        (known === undefined || known.state === "missing") &&
        !this.requested.has(id)
      );
    });
    if (fields.length === 0) return null;
    for (const field of fields) {
      this.requested.add(fieldKey(locale, key, field.name, field.fingerprint));
    }

    return { ...target, fields };
  }

  get(
    locale: string,
    item: string,
    field: string,
    fingerprint: string,
  ): AutoTranslateFieldResult | undefined {
    return this.results.get(fieldKey(locale, item, field, fingerprint));
  }

  /**
   * Stores an answer for the fields `asked` named. A field whose result does
   * not carry the fingerprint the page asked with is dropped, except for the
   * states that say so themselves (`stale`, or `unavailable` for a record
   * that cannot be read).
   */
  ingest(
    response: AutoTranslateResponse,
    asked: readonly AutoTranslateItemRequest[],
  ): void {
    const expected = new Map(
      asked.map(item => [
        autoTranslateItemKey(item.contentTypeId, item.id),
        new Map(item.fields.map(field => [field.name, field.fingerprint])),
      ]),
    );
    let changed = false;
    for (const item of response.items) {
      const key = autoTranslateItemKey(item.contentTypeId, item.id);
      const fields = expected.get(key);
      if (!fields) continue;
      for (const result of item.fields) {
        const fingerprint = fields.get(result.name);
        if (fingerprint === undefined) continue;
        const matches =
          result.fingerprint === fingerprint ||
          result.state === "stale" ||
          (result.state === "unavailable" && result.fingerprint === null);
        if (!matches) continue;
        this.results.set(
          fieldKey(response.locale, key, result.name, fingerprint),
          result,
        );
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  isManual(locale: string, item: string): boolean {
    return this.manual.has(`${locale}\u0000${item}`);
  }

  /** Whether any field of `target` is still being translated. */
  isPending(locale: string, target: AutoTranslateItemRequest): boolean {
    const key = autoTranslateItemKey(target.contentTypeId, target.id);

    return target.fields.some(
      field =>
        this.get(locale, key, field.name, field.fingerprint)?.state ===
        "pending",
    );
  }

  isShowingOriginal(item: string): boolean {
    return this.showingOriginal.has(item);
  }

  /** Lets fields be requested again, after a request failed. */
  release(locale: string, target: AutoTranslateItemRequest): void {
    const key = autoTranslateItemKey(target.contentTypeId, target.id);
    for (const field of target.fields) {
      this.requested.delete(
        fieldKey(locale, key, field.name, field.fingerprint),
      );
    }
  }

  setManual(locale: string, item: string): void {
    this.manual.add(`${locale}\u0000${item}`);
    this.showingOriginal.delete(item);
    this.emit();
  }

  setShowingOriginal(item: string, original: boolean): void {
    if (original) this.showingOriginal.add(item);
    else this.showingOriginal.delete(item);
    this.emit();
  }

  /** Repaints after a change outside the store, such as the reader's switch. */
  touch(): void {
    this.emit();
  }
}
