import type { BlockRegistry } from "../../blocks/types";
import type {
  EditorContainerRef,
  EditorZoneState,
  TargetCapabilities,
  VisualEditorState,
} from "./types";

import { BLOCK_WILDCARD } from "../../blocks/const";
import { getDefaultBlockRegistry, isBlockAllowed } from "../../blocks/registry";

export const zoneRegistry = (
  zone: EditorZoneState | undefined,
): BlockRegistry | undefined => zone?.registry ?? getDefaultBlockRegistry();

export const targetCapabilities = (
  state: VisualEditorState,
  container: EditorContainerRef,
): TargetCapabilities => {
  const zone = state.zones[container.zoneId];
  const registry = zoneRegistry(zone);
  const allowedBlocks = zone?.allowedBlocks;

  return {
    allows: type => isBlockAllowed(allowedBlocks ?? BLOCK_WILDCARD, type),
    known: registry !== undefined,
    registers: type => registry?.has(type) ?? false,
  };
};

export const acceptsEveryType = (
  capabilities: TargetCapabilities,
  types: readonly string[],
): boolean =>
  types.every(
    type => capabilities.registers(type) && capabilities.allows(type),
  );

export const refusesAnyType = (
  capabilities: TargetCapabilities,
  types: readonly string[],
): boolean => capabilities.known && !acceptsEveryType(capabilities, types);
