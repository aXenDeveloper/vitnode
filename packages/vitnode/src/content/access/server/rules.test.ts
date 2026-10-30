import { describe, expect, it } from "vitest";

import type { ContentDatabase } from "@/content/server/service";

import { writeAuditLog } from "@/api/lib/audit/write";
import { core_audit_logs } from "@/database/audit";
import { core_content_access_rules } from "@/database/content-access";
import {
  BOARD,
  createAccessWorld,
  testAccessBoards,
} from "@/tests/content-access";

import { replaceContentAccessRules } from "./rules";

describe("replaceContentAccessRules", () => {
  it("runs `within` after the rules in their transaction, so a failure there rolls both back", async () => {
    const world = await createAccessWorld();
    const rules = world.memory.rows(core_content_access_rules);
    const seen: unknown[] = [];

    await expect(
      replaceContentAccessRules(world.memory.db as unknown as ContentDatabase, {
        family: testAccessBoards.id,
        overrides: { view: { mode: "members" } },
        scopeId: String(BOARD.OPEN),
        within: async tx => {
          seen.push(
            ...(await tx
              .select({ mode: core_content_access_rules.mode })
              .from(core_content_access_rules)),
          );
          await writeAuditLog(
            world.contextFor(),
            { action: "content.access_updated", target: { type: "board" } },
            tx,
          );
          throw new Error("the audit entry failed");
        },
      }),
    ).rejects.toThrow("the audit entry failed");

    expect(seen).toHaveLength(rules.length + 1);
    expect(world.memory.rows(core_content_access_rules)).toEqual(rules);
    expect(world.memory.rows(core_audit_logs)).toEqual([]);
  });
});
