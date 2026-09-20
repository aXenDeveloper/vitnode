export const BLOCK_NAMESPACE_SEPARATOR = ":";

export const BLOCK_WILDCARD = "*";

export const BLOCK_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BLOCK_NAMESPACE_PATTERN = BLOCK_NAME_PATTERN;

export const BLOCK_ID_MAX_LENGTH = 64;

export const BLOCK_INSTANCE_ID_LENGTH = 26;

export const BLOCK_INSTANCE_ID_MAX_LENGTH = 64;

export const BLOCK_INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const CONTENT_BLOCKS_DEFAULT_MAX = 200;

export const CONTENT_BLOCKS_ABSOLUTE_MAX = 1000;

export const CONTENT_ZONE_SEPARATOR = ":";

export const CONTENT_ZONE_ID_MAX_LENGTH = 64;

export const CONTENT_ZONE_ID_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const CONTENT_ZONE_ATTRIBUTE = "data-vitnode-zone";

export const CONTENT_ZONE_ALLOWED_ATTRIBUTE = "data-vitnode-zone-allowed";

export const CONTENT_AREA_KIND = "area";

export const AREA_COLUMNS = [1, 2, 3, 4] as const;

export const AREA_SPACING_MIN = 0;

export const AREA_SPACING_MAX = 100;

/**
 * What the four named steps areas used to be laid out with are worth.
 *
 * Kept so a layout stored before spacing was measured in pixels still reads:
 * every door into a layout resolves one of these to its number, and the next
 * save writes that number down instead.
 */
export const AREA_LEGACY_SPACING = {
  lg: 32,
  md: 16,
  none: 0,
  sm: 8,
} as const;

export const AREA_LEGACY_SPACINGS = ["none", "sm", "md", "lg"] as const;

export const AREA_ALIGNS = ["start", "center", "stretch"] as const;

export const AREA_JUSTIFIES = ["start", "center", "stretch"] as const;

export const AREA_DEFAULT_COLUMNS = 2;

export const AREA_DEFAULT_GAP = 16;

export const AREA_DEFAULT_ALIGN = "stretch";

export const AREA_DEFAULT_JUSTIFY = "stretch";

export const AREA_DEFAULT_MARGIN = 0;

export const AREA_CHILDREN_DEFAULT_MAX = 50;

export const BLOCK_VARIANT_ID_MAX_LENGTH = 32;

export const BLOCK_VARIANT_PATTERN = BLOCK_NAME_PATTERN;
