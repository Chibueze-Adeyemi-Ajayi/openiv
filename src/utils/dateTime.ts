// All timestamps from the backend are UTC (TIMESTAMPTZ normalised by PostgreSQL).
// Nigeria operates on WAT = UTC+1 (Africa/Lagos, no DST).
// Always pass timeZone explicitly so display is correct regardless of the
// browser/server system timezone.

const LOCALE   = 'en-NG'
let TIMEZONE = 'Africa/Lagos'

/** Update the global display timezone (e.g. after loading user session). */
export function setDisplayTimezone(tz: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz }) // validate
    TIMEZONE = tz
  } catch (e) {
    console.warn('Invalid timezone, falling back to Lagos:', tz)
    TIMEZONE = 'Africa/Lagos'
  }
}

export function getDisplayTimezone(): string {
  return TIMEZONE
}

type DateInput = string | number | Date

function d(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input)
}

/** "09 May 2026" */
export function fmtDate(input: DateInput): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE,
  }).format(d(input))
}

/** "21:04" */
export function fmtTime(input: DateInput): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIMEZONE,
  }).format(d(input))
}

/** "09 May 2026, 21:04" */
export function fmtDateTime(input: DateInput): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIMEZONE,
  }).format(d(input))
}

/** Custom formatter — always injects the correct timezone. */
export function fmtCustom(input: DateInput, opts: Omit<Intl.DateTimeFormatOptions, 'timeZone'>): string {
  return new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: TIMEZONE }).format(d(input))
}
