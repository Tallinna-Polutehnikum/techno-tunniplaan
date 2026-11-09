/** Reading group and room codes: the year a group started, and the building a room is in. */

/** "K-TA-24A" → "24": the two-digit year in a group code, or null ("BRON", "VALIK"). */
export function groupYear(name) {
  return name.match(/(?<!\d)(\d{2})(?!\d)/)?.[1] ?? null;
}

/**
 * The building a room is in, or null ("Teamsis"). Tahvel names start with the building
 * ("PM - E243", "Peamaja - J-216"); the others with a one- or two-letter building code, after the
 * campus letter where there is one ("A-307", "M-A116", "K-B136 (raamatukogu)", "B-033 - 035").
 */
export function roomBuilding(name) {
  const tahvel = name.match(/^([A-Za-zÕÄÖÜõäöü]{2,}) - /);
  if (tahvel) return tahvel[1];
  return name.replace(/^[KMJL]-(?=[A-Z])/, '').match(/^([A-Z]{1,2})[-\d]/)?.[1] ?? null;
}

/** A room's name without its Tahvel building ("Peamaja - J-216" → "J-216"), for tiles that already say the building. */
export function roomShort(name) {
  return name.replace(/^[A-Za-zÕÄÖÜõäöü]{2,} - /, '');
}

/** The letter a teacher's surname starts with; teachers are written "Last First". */
export function surnameLetter(name) {
  return name.trim()[0]?.toLocaleUpperCase('et') ?? '#';
}
