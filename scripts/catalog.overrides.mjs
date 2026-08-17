// Human-reviewed data. Political choices live here, never in code.
// Continent codes: AF Africa · AM Americas · AS Asia · EU Europe · OC Oceania

/** country code → continent, when tzdb's continent for that country is not the one we want to show. */
export const CONTINENT_OVERRIDES = {
  // e.g. TR: 'EU'  — none required at launch; tzdb's assignment is used as-is
}

/** tzdb continent codes to drop entirely. */
export const EXCLUDED_CONTINENTS = new Set(['AN'])

/** IANA zone ids to drop even if tzdb lists them. */
export const EXCLUDED_ZONES = new Set([])
