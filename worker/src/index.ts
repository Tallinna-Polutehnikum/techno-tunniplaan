/**
 * Two jobs, both for the timetable site:
 *
 * 1. Relay for the requests scripts/fetch-timetable.ts makes, for deploys running on GitHub Actions
 *    IPs that Edupage drops. Only these are forwarded, so this is not an open proxy:
 *
 *      POST /edupage/<school>/timetable/server/{ttviewer,regulartt}.js?...  ->  https://<school>.edupage.org/...
 *      GET  /tahvel/hois_back/timetableevents/timetableSearch?...           ->  https://tahveltp.edu.ee/...
 *
 * 2. Calendar feeds a phone can subscribe to, built from the snapshot on the site:
 *
 *      GET  /ics/{group,teacher}/<name>.ics  ->  text/calendar
 */
import { buildIcs, canonical, type Index, type Kind, type Week } from "./ics";

const EDUPAGE_SCHOOLS = new Set(["kesklinn-techno", "mustamae-techno"]);
const EDUPAGE_PATHS = new Set(["/timetable/server/ttviewer.js", "/timetable/server/regulartt.js"]);
const TAHVEL_PATHS = new Set(["/hois_back/timetableevents/timetableSearch"]);

/** Where the deploy publishes the snapshot the feeds are built from. */
const DATA = "https://kasparsu.github.io/tahvel-tunniplaan/data/";
/** The snapshot is rebuilt every 30 minutes, so nothing is gained by holding a feed longer. */
const CACHE_SECONDS = 1800;

function target(request: Request): string | null {
  const url = new URL(request.url);
  const [, kind, ...rest] = url.pathname.split("/");
  if (kind === "edupage" && request.method === "POST") {
    const [school, ...path] = rest;
    const p = `/${path.join("/")}`;
    if (EDUPAGE_SCHOOLS.has(school) && EDUPAGE_PATHS.has(p)) return `https://${school}.edupage.org${p}${url.search}`;
  }
  if (kind === "tahvel" && request.method === "GET") {
    const p = `/${rest.join("/")}`;
    if (TAHVEL_PATHS.has(p)) return `https://tahveltp.edu.ee${p}${url.search}`;
  }
  return null;
}

/** A snapshot file, cached at the edge so a calendar app polling does not re-fetch every week. */
async function data<T>(file: string): Promise<T> {
  const res = await fetch(`${DATA}${file}`, { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** GET /ics/<kind>/<name>.ics */
async function icsResponse(path: string[]): Promise<Response> {
  const [kind, file] = path;
  if ((kind !== "group" && kind !== "teacher") || !file?.endsWith(".ics")) return new Response("Not found", { status: 404 });
  const asked = decodeURIComponent(file.slice(0, -4));

  let index: Index;
  try {
    index = await data<Index>("index.json");
  } catch {
    // the site is the source of truth; if it cannot be read, say so rather than serve an empty calendar
    return new Response("Timetable data unavailable", { status: 502 });
  }
  const name = canonical(kind === "group" ? index.classes : index.teachers, asked);
  if (!name) return new Response(`No such ${kind}`, { status: 404 });

  let weeks: Week[];
  try {
    weeks = await Promise.all(index.weeks.map((w) => data<Week>(w.file)));
  } catch {
    return new Response("Timetable data unavailable", { status: 502 });
  }

  return new Response(buildIcs({ kind: kind as Kind, name, index, weeks }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // a sensible name when a browser saves it instead of subscribing
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(`${name}.ics`)}`,
      "cache-control": `public, max-age=${CACHE_SECONDS}`,
      "access-control-allow-origin": "*",
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const [, kind, ...rest] = new URL(request.url).pathname.split("/");
    if (kind === "ics") {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      return icsResponse(rest);
    }

    const to = target(request);
    if (!to) return new Response("Not found", { status: 404 });
    const upstream = await fetch(to, {
      method: request.method,
      headers: { "content-type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  },
};
