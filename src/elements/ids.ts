/**
 * Element key → numeric id. Filled in by the registry at startup; element
 * update functions read from it at runtime (e.g. `ID.fire`).
 */
export const ID: Record<string, number> = Object.create(null);
