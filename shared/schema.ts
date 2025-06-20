import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const races = pgTable("races", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  textPassage: text("text_passage").notNull(),
  maxPlayers: integer("max_players").notNull().default(4),
  difficulty: text("difficulty").notNull().default("medium"),
  timeLimit: integer("time_limit").notNull().default(180), // seconds
  status: text("status").notNull().default("waiting"), // waiting, active, finished
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});

export const raceParticipants = pgTable("race_participants", {
  id: serial("id").primaryKey(),
  raceId: integer("race_id").notNull(),
  playerId: text("player_id").notNull(), // WebSocket session ID
  playerName: text("player_name").notNull(),
  progress: integer("progress").notNull().default(0), // characters typed
  wpm: integer("wpm").notNull().default(0),
  accuracy: integer("accuracy").notNull().default(100),
  errors: integer("errors").notNull().default(0),
  finished: boolean("finished").notNull().default(false),
  finishedAt: timestamp("finished_at"),
  rank: integer("rank"),
});

export const textPassages = pgTable("text_passages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  difficulty: text("difficulty").notNull(),
  length: integer("length").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertRaceSchema = createInsertSchema(races).pick({
  name: true,
  maxPlayers: true,
  difficulty: true,
  timeLimit: true,
}).extend({
  maxPlayers: z.number().default(4),
  difficulty: z.string().default('medium'),
  timeLimit: z.number().default(180),
});

export const insertRaceParticipantSchema = createInsertSchema(raceParticipants).pick({
  raceId: true,
  playerId: true,
  playerName: true,
});

export const insertTextPassageSchema = createInsertSchema(textPassages).pick({
  content: true,
  difficulty: true,
  length: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRace = z.infer<typeof insertRaceSchema>;
export type Race = typeof races.$inferSelect;
export type InsertRaceParticipant = z.infer<typeof insertRaceParticipantSchema>;
export type RaceParticipant = typeof raceParticipants.$inferSelect;
export type InsertTextPassage = z.infer<typeof insertTextPassageSchema>;
export type TextPassage = typeof textPassages.$inferSelect;

// WebSocket message types
export type WebSocketMessage = 
  | { type: 'join_race'; data: { raceId: number; playerName: string } }
  | { type: 'leave_race'; data: { raceId: number } }
  | { type: 'typing_update'; data: { raceId: number; progress: number; wpm: number; accuracy: number; errors: number } }
  | { type: 'race_update'; data: { race: Race; participants: RaceParticipant[] } }
  | { type: 'race_started'; data: { raceId: number } }
  | { type: 'race_finished'; data: { raceId: number; results: RaceParticipant[] } }
  | { type: 'player_joined'; data: { raceId: number; participant: RaceParticipant } }
  | { type: 'player_left'; data: { raceId: number; playerId: string } }
  | { type: 'error'; data: { message: string } };
