import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { GameEvent } from '../game/events'

const DB_PATH = process.env.WEREWOLF_DB ?? resolve(process.cwd(), 'data/werewolf.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS room (
    code        TEXT PRIMARY KEY,
    host_token  TEXT NOT NULL,
    host_name   TEXT NOT NULL DEFAULT 'Quản trò',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    ended_at    INTEGER
  );

  CREATE TABLE IF NOT EXISTS event (
    code    TEXT NOT NULL,
    seq     INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (code, seq)
  );

  CREATE TABLE IF NOT EXISTS member (
    id    TEXT PRIMARY KEY,
    code  TEXT NOT NULL,
    token TEXT NOT NULL,
    name  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_member_code ON member(code);
`)

const stmt = {
  insertRoom: db.prepare(
    'INSERT INTO room (code, host_token, host_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ),
  getRoom: db.prepare('SELECT * FROM room WHERE code = ?'),
  touchRoom: db.prepare('UPDATE room SET updated_at = ? WHERE code = ?'),
  endRoom: db.prepare('UPDATE room SET ended_at = ? WHERE code = ?'),
  listRooms: db.prepare('SELECT * FROM room ORDER BY created_at DESC LIMIT ?'),
  insertEvent: db.prepare('INSERT INTO event (code, seq, payload) VALUES (?, ?, ?)'),
  listEvents: db.prepare('SELECT seq, payload FROM event WHERE code = ? ORDER BY seq ASC'),
  deleteEventsFrom: db.prepare('DELETE FROM event WHERE code = ? AND seq >= ?'),
  upsertMember: db.prepare(
    'INSERT INTO member (id, code, token, name) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name',
  ),
  getMemberByToken: db.prepare('SELECT * FROM member WHERE code = ? AND token = ?'),
  deleteMember: db.prepare('DELETE FROM member WHERE id = ?'),
}

export type RoomRow = {
  code: string
  host_token: string
  host_name: string
  created_at: number
  updated_at: number
  ended_at: number | null
}

export type MemberRow = { id: string; code: string; token: string; name: string }

export const store = {
  createRoom(code: string, hostToken: string, hostName: string): void {
    const now = Date.now()
    stmt.insertRoom.run(code, hostToken, hostName, now, now)
  },

  getRoom(code: string): RoomRow | undefined {
    return stmt.getRoom.get(code) as RoomRow | undefined
  },

  listRooms(limit = 30): RoomRow[] {
    return stmt.listRooms.all(limit) as unknown as RoomRow[]
  },

  endRoom(code: string): void {
    stmt.endRoom.run(Date.now(), code)
  },

  appendEvent(code: string, seq: number, event: GameEvent): void {
    stmt.insertEvent.run(code, seq, JSON.stringify(event))
    stmt.touchRoom.run(Date.now(), code)
  },

  loadEvents(code: string): GameEvent[] {
    const rows = stmt.listEvents.all(code) as unknown as { seq: number; payload: string }[]
    return rows.map((r) => JSON.parse(r.payload) as GameEvent)
  },

  truncateEventsFrom(code: string, seq: number): void {
    stmt.deleteEventsFrom.run(code, seq)
    stmt.touchRoom.run(Date.now(), code)
  },

  saveMember(member: MemberRow): void {
    stmt.upsertMember.run(member.id, member.code, member.token, member.name)
  },

  memberByToken(code: string, token: string): MemberRow | undefined {
    return stmt.getMemberByToken.get(code, token) as MemberRow | undefined
  },

  removeMember(id: string): void {
    stmt.deleteMember.run(id)
  },
}
