export interface ZonesSearch {
  edit?: true;
}

export const zonesSearch = (input: Record<string, unknown>): ZonesSearch =>
  input.edit === true || input.edit === "true" ? { edit: true } : {};
