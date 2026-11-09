/**
 * Room details a campus publishes (https://technoweb.blob.core.windows.net/ruumiplaanid/<campus>.json):
 * student seats, computers, presentation equipment and boards, kept compact for index.json.
 */
import { clean, fetchJson } from "./types";

type Row = Record<string, any>;

export interface RoomInfo {
  title: string; // "Arvutiklass"
  seats: number; // student seats
  computers: number; // student computers
  platforms: string[]; // "windows", "mac"
  equipment: string[]; // "projector", "interactive_display", "television", "printer", "whiteboard", "chalkboard"
  tvs?: number; // televisions, when more than one
}

/** Room code (as the timetables write it, "A-002") to its details. */
export async function fetchRoomInfo(url: string): Promise<Map<string, RoomInfo>> {
  const body = await fetchJson<Row>(url);
  if (body.schemaVersion !== 1) throw new Error(`${url}: unknown schemaVersion ${body.schemaVersion}`);
  const rooms = new Map<string, RoomInfo>();
  for (const r of body.rooms ?? []) {
    const code = clean(r.roomCode);
    if (!code) continue;
    const presentation: Row[] = r.presentation ?? [];
    const tvs = presentation.filter((p) => p.type === "television").reduce((n, p) => n + (Number(p.count) || 1), 0);
    rooms.set(code, {
      title: clean(r.name),
      seats: Number(r.studentSeats) || 0,
      computers: Number(r.studentComputers?.count) || 0,
      platforms: r.studentComputers?.platforms ?? [],
      equipment: [...new Set([...presentation.map((p) => String(p.type)), ...(r.boards ?? [])])],
      ...(tvs > 1 && { tvs }),
    });
  }
  return rooms;
}
