# Tunniplaan

Mobile-friendly timetable for Techno TLN: search a group, a teacher or a room, see the day or
the week, and step between the weeks the school has published. "Vabad ruumid" lists the rooms of
a campus with no lesson in a given period, and until when they stay free. "Koolilõuna" shows each
campus's school lunch menu by day. Installable as an app (PWA) and readable offline.

Settings → "Kioskirežiim" turns the app into a touch screen for one campus. Its home screen has four
big panels — "Tunnid täna", "Tunniplaanid", "Vabad ruumid" and "Lõuna" — and the first two go on to
ask whose: a group's, a teacher's or a room's. "Tunnid täna" also boards the lessons on now and next
for the whole campus or one building, like Tahvel's school board. A week shows on one screen (a column
per day, time running down with the lesson start and end times marked), and free rooms get the day,
time and room filters in a sidebar of big buttons. Groups are picked by starting year then code, rooms
by building then number, teachers from a surname-letter rail, so nothing needs a keyboard. A kiosk
returns to its home screen after 90 s untouched, re-reads the data every 10 minutes and reloads at
04:00; holding the logo for 2 s opens settings.

Every timetable has its own link: `#/plaan/<group|teacher|room>/<name>`, with `?vaade=tana` for the
day, `?vaade=paev&paev=2` for one weekday and `?nadal=2026-10-05` for a week other than the current
one (the current week is left out, so a copied link keeps opening on whichever week is current). The
address bar follows what is on screen, so it is always a link worth copying, and an old Tahvel
spelling of a name still finds its group. Each kiosk page shows its own link as a QR code, so a
passer-by can scan the screen and take the timetable, the free rooms or the lunch menu with them.

A group's or teacher's timetable can also be subscribed to in a calendar app: "Lisa kalendrisse"
under the lessons offers the feed as a `webcal:` link, as a Google Calendar "add by URL" link, and
as a URL to copy. Because it is a subscription rather than an imported file, a room or time change
reaches the calendar on its own. The worker serves the feed (`/ics/{group,teacher}/<name>.ics`,
`worker/src/ics.ts`), built on request from the same snapshot the site reads: there are 500-odd
groups and teachers, and a file each would be some 17 MB on every deploy, into a branch committed
twice an hour. Lessons are published as local times, so events carry UTC stamps and need no
VTIMEZONE; bookings (`BRON`) are left out, and rooms get no feed.

Kesklinn publishes room details (https://technoweb.blob.core.windows.net/ruumiplaanid/kesklinn.json):
student seats, computers (count, Windows or Mac), projectors, interactive displays, TVs and boards.
The fetch adds them to `index.json`, free rooms show them as icons and can be filtered by them, and
its listed rooms without lessons count as free too. If the file cannot be fetched, the deploy goes
on without room details.

Lunch menus come from https://menuu.techno.ee/menu.php?format=json, which gives every campus its
weeks as data. The fetch reads them into `lunch.json` (the meals to choose between and what is served
with all of them, with ingredients, amounts, energy and allergens, plus each campus's notes); if the
feed cannot be read, the deploy goes on and the lunch page says the menu is unavailable. Mustamäe's
kitchen reports through a different provider and the feed passes that through unchanged — a flat list
per day rather than a choice, and allergens as numbers that are not the EU's and that nothing in the
feed explains, so those are left out rather than guessed at. No system publishes when lunch is, so the
fetch takes each campus's lunch break from its groups' timetables (the midday gap most of them share,
11:45-12:45 at most campuses) into each week's file. A group's or teacher's timetable shows a "Lõuna"
card with the day's meals when that break falls between their lessons, as it does Järve's "Söögitund"
lessons; the card opens the menu. Settings → "Näita lõunat" hides them.

The campuses keep their timetables in different systems, and the app merges them so one
search covers all of them:

| Campus | Group codes | Timetable |
|---|---|---|
| Kesklinn | `K-…` | [Edupage](https://kesklinn-techno.edupage.org/timetable/) |
| Mustamäe | `M-…` | [Edupage](https://mustamae-techno.edupage.org/timetable/) |
| Järve | `J-…` | [Tahvel, school 24](https://tahveltp.edu.ee/#/schoolBoard/24) |
| Lasnamäe | `L-…` | Tahvel, school 24 |

Groups and teachers do move between campuses, so each lesson's campus comes from its room when
that says (Tahvel's building, a campus-lettered room code like `M-A138`, or Kesklinn's
placeholder rooms named after a campus), then from which Edupage it is in, then from its group
code. Free periods use that campus's bell times, and a group or teacher at several campuses gets
the campus on each lesson card.

Neither system sends CORS headers, so the browser cannot read them directly. Instead
`scripts/fetch-timetable.ts` (with one module per system in `scripts/providers/`) takes a
snapshot into `public/data/`: `index.json` plus one merged JSON file per week, from last week
on. The site reads those static files. The deploy workflow runs the fetch before every build
and on a schedule (every 30 minutes on school days), so the site stays current without commits.

```bash
bun install
bun run fetch      # snapshot every source into public/data/
bun run dev        # http://localhost:5173/
bun run build && bun run preview
```

Merging: a lesson entered in two systems (Kesklinn's Edupage with the room "Lasnamäe", Tahvel
with the real room) is kept once, with the real room. Teachers who appear in several sources are matched by name regardless of word order
(Tahvel's "First Last" is stored as Edupage's "Last First"), and Mustamäe's surname-only
teachers are matched to the one full name starting with that surname. Tahvel's 45-minute events
are joined into double lessons, and its bell schedule is read off the event times.

Edupage's school servers drop connections from some GitHub Actions IPs, so the deploy workflow
fetches through a Cloudflare Worker (`worker/`, deploy with `bun run worker:deploy`) that only
relays the timetable endpoints above. The same worker serves the calendar feeds, so deploy it after
changing either; `bunx wrangler dev -c worker/wrangler.jsonc` runs it locally.

Selections saved by the earlier Tahvel-based version are carried over by name.

GitHub switches off scheduled workflows in a repository with no activity for 60 days;
re-enable it on the Actions tab (or push anything) if the data stops updating.
