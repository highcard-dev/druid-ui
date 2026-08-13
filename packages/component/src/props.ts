export const lowerPropertyValue = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);
