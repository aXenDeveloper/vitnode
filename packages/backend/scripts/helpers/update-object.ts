// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-parameters
export function objectToArray<T extends Record<string, any>>(
  obj: T,
): Record<string, unknown> {
  if (typeof obj !== 'object') {
    return obj;
  }

  return Object.entries(obj).reduce(
    (acc: Record<string, unknown>, [key, value]) => {
      if (Array.isArray(value)) {
        acc[key] = value.map(objectToArray);
      } else if (typeof value === 'object' && value !== null) {
        acc[key] = [objectToArray(value)];
      } else {
        acc[key] = value;
      }

      return acc;
    },
    {},
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateObject<T extends Record<string, any>>(
  config: T,
  defaultData: T,
): T {
  const updatedConfig = config;
  for (const key in defaultData) {
    if (Array.isArray(defaultData[key])) {
      // If the key corresponds to an array and it's not empty, don't edit
      if (!config[key] || config[key].length === 0) {
        updatedConfig[key] = [] as never;
      }
    } else if (
      typeof defaultData[key] === 'object' &&
      defaultData[key] !== null
    ) {
      // Handle nested objects
      if (!config[key]) {
        updatedConfig[key] = {} as T[Extract<keyof T, string>];
      }
      updatedConfig[key] = updateObject(
        (config[key] || {}) as T[Extract<keyof T, string>],
        defaultData[key],
      );
    } else {
      // Handle primitive values
      if (!config[key]) {
        updatedConfig[key] = defaultData[key];
      }
    }
  }

  return updatedConfig;
}
