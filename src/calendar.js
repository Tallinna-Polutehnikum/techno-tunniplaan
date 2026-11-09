/**
 * Calendar feeds. The worker (worker/src/ics.ts) serves one group's or teacher's lessons as
 * iCalendar, so a calendar app can subscribe to the URL and follow the timetable as it changes
 * instead of holding a copy that goes stale.
 */

// The same worker the deploy relays its fetches through (see .github/workflows/deploy.yml).
const FEED = 'https://tahvel-edupage-proxy.kasparsu.workers.dev/ics';

/** What anyone would put in their own calendar; rooms get no feed. */
const KINDS = ['group', 'teacher'];
export const canSubscribe = (sel) => !!sel && KINDS.includes(sel.type);

/**
 * The name goes into the URL as a slug ("suursalu-kaspar-martin"). The worker matches names on their
 * words, so this resolves to the same person, and the URL carries no percent-encoded spaces — which
 * is what a URL field in a calendar app is least likely to argue with.
 */
const slug = (name) =>
  name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const feedUrl = ({ type, name }) => `${FEED}/${type}/${slug(name)}.ics`;

/** webcal: hands the feed straight to whichever calendar app the device has. */
export const webcalUrl = (sel) => feedUrl(sel).replace(/^https:/, 'webcal:');

/**
 * Google Calendar's "add by URL" dialog, opened empty for the link to be pasted into. It is not
 * handed the feed: calendar.google.com/calendar/r?cid=<feed> refuses an https address with "Unable to
 * add this URL", and takes a webcal: one only sometimes, while that field accepts a pasted https
 * address reliably.
 */
export const GOOGLE_ADD_URL = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl';
