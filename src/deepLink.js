/**
 * Shareable links into the normal (non-kiosk) app: #/plaan/<type>/<name>, the view in the query
 * (?vaade=tana, ?nadal=2026-10-05, ?paev=2). The timetable keeps the address bar on such a link so it
 * can be copied, and a kiosk shows one as a QR code so a passer-by can take the timetable with them.
 */

/** What ?vaade= names, in the timetable's own display types. */
export const VIEWS = { nadal: 'week', tana: 'today', paev: 'day' };
const SPELLING = { week: 'nadal', today: 'tana', day: 'paev' };

/**
 * A router location for a selection and a view. A week is pinned so the link keeps showing the week it
 * was made from; "today" is left unpinned, being about whenever it is opened.
 */
export function linkTo({ type, name, display = 'week', monday = '', weekday = null }) {
  const query = {};
  if (display !== 'week') query.vaade = SPELLING[display];
  if (display === 'day' && weekday !== null) query.paev = String(weekday);
  if (display !== 'today' && monday) query.nadal = monday;
  return { name: 'timetable-for', params: { type, name }, query };
}

/** What a link asks for, as `openLink` takes it. */
export function linkFrom(route) {
  return {
    type: route.params.type,
    name: route.params.name,
    display: VIEWS[route.query.vaade] ?? 'week',
    weekday: Number(route.query.paev) || 0,
    monday: String(route.query.nadal ?? ''),
  };
}

/** A router location as an absolute URL, for a QR code. Hash routing: the path goes after the '#'. */
export function absolute(router, to) {
  return `${location.href.replace(/#.*$/, '')}#${router.resolve(to).fullPath}`;
}
