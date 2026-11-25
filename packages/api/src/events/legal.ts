import { z } from "zod";

import { LEGAL_DOCUMENT_TYPES } from "@/lib/legal/contract";
import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

const zodDocumentType = z.enum(LEGAL_DOCUMENT_TYPES);

/** A legal document draft was created, saved or discarded in the AdminCP. */
export const legalDraftUpdatedEvent = defineEvent({
  pluginId,
  name: "legal.draft.updated",
  payload: z.object({
    documentType: zodDocumentType,
    action: z.enum(["created", "saved", "discarded"]),
    actorId: z.number().int().nullable(),
  }),
});

/**
 * A new version was announced: it is stored, frozen, and its announcement
 * emails are queued. It may take effect later (`effectiveAt`). Fires after the
 * transaction commits.
 */
export const legalVersionAnnouncedEvent = defineEvent({
  pluginId,
  name: "legal.version.announced",
  payload: z.object({
    documentType: zodDocumentType,
    versionId: z.number().int(),
    version: z.number().int(),
    effectiveAt: z.string(),
    requiresAcceptance: z.boolean(),
    publishedById: z.number().int().nullable(),
  }),
});

/**
 * A version became the effective one: at announcement for an immediate
 * release, or when its scheduled time arrives.
 */
export const legalVersionEffectiveEvent = defineEvent({
  pluginId,
  name: "legal.version.effective",
  payload: z.object({
    documentType: zodDocumentType,
    versionId: z.number().int(),
    version: z.number().int(),
    requiresAcceptance: z.boolean(),
  }),
});

/** A member accepted a Terms of Service version. Not fired for a repeated acceptance. */
export const legalTermsAcceptedEvent = defineEvent({
  pluginId,
  name: "legal.terms.accepted",
  payload: z.object({
    userId: z.number().int(),
    versionId: z.number().int(),
    version: z.number().int(),
    source: z.enum(["signup", "gate"]),
  }),
});

/** Every `legal.*` event core defines. */
export const legalEventDefinitions = [
  legalDraftUpdatedEvent,
  legalVersionAnnouncedEvent,
  legalVersionEffectiveEvent,
  legalTermsAcceptedEvent,
];
