export { DevicesPanelContent, DevicesPanelPending } from "./panel";
/**
 * `@vitnode/core/tanstack/devices` - the visitor's signed-in devices.
 *
 *     ./query  the eager half: the query definition, the revoke and the
 *              invalidation a route's loader warms and its callbacks call
 *     ./panel  the rendered list, reached only through a route's `component:`
 *
 * Split for the reason every screen namespace here is: a route file's `loader`
 * is evaluated in the client entry, so a loader importing the panel beside the
 * query puts the device list in the first bundle of every page of the
 * application.
 */
export * from "./query";
/**
 * The key factory, re-exported so a route has one place to reach for.
 *
 * Left to be imported from `views/auth/settings/devices/devices-query` it would
 * be a second spelling waiting to be invented, and an entry this module's
 * invalidation would then miss.
 */
export {
  devicesQueryKey,
  DevicesRequestError,
  isDevicesRequestError,
} from "@/views/auth/settings/devices/devices-query";
export type {
  Device,
  DevicesApi,
  DeviceType,
} from "@/views/auth/settings/devices/devices-query";
export type {
  RevokeDevice,
  RevokeDeviceArgs,
  RevokeDeviceResult,
} from "@/views/auth/settings/devices/devices-revoke";
