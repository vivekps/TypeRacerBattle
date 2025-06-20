import { races, raceParticipants, textPassages, type Race, type RaceParticipant, type TextPassage, type InsertRace, type InsertRaceParticipant, type InsertTextPassage } from '@shared/schema';
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Race operations
  createRace(race: InsertRace): Promise<Race>;
  getRace(id: number): Promise<Race | undefined>;
  getRaces(status?: string): Promise<Race[]>;
  updateRaceStatus(id: number, status: string): Promise<void>;
  setRaceStartTime(id: number): Promise<void>;
  setRaceFinishTime(id: number): Promise<void>;
  
  // Race participant operations
  addParticipant(participant: InsertRaceParticipant): Promise<RaceParticipant>;
  removeParticipant(raceId: number, playerId: string): Promise<void>;
  getRaceParticipants(raceId: number): Promise<RaceParticipant[]>;
  updateParticipantProgress(raceId: number, playerId: string, progress: number, wpm: number, accuracy: number, errors: number): Promise<void>;
  finishParticipant(raceId: number, playerId: string): Promise<void>;
  updateParticipantRanks(raceId: number): Promise<void>;
  
  // Text passage operations
  getTextPassage(difficulty: string): Promise<TextPassage | undefined>;
  getAllTextPassages(): Promise<TextPassage[]>;
  addTextPassage(passage: InsertTextPassage): Promise<TextPassage>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeTextPassages();
  }

  private async initializeTextPassages() {
    try {
      const existingPassages = await this.getAllTextPassages();
      if (existingPassages.length === 0) {
        console.log('Initializing default text passages...');
        
        const defaultPassages = [
          {
            content: "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the alphabet at least once.",
            difficulty: "easy",
            length: 108
          },
          {
            content: "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort.",
            difficulty: "medium", 
            length: 233
          },
          {
            content: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.",
            difficulty: "hard",
            length: 301
          }
        ];

        for (const passage of defaultPassages) {
          await this.addTextPassage(passage);
        }
        console.log('Default text passages initialized');
      }
    } catch (error) {
      console.error('Error initializing text passages:', error);
    }
  }

  async createRace(insertRace: InsertRace): Promise<Race> {
    // Get a random text passage for the race
    const textPassage = await this.getTextPassage(insertRace.difficulty);
    if (!textPassage) {
      throw new Error(`No text passages found for difficulty: ${insertRace.difficulty}`);
    }

    const raceData = {
      ...insertRace,
      textPassage: textPassage.content
    };

    const [race] = await db.insert(races).values([raceData]).returning();
    return race;
  }

  async getRace(id: number): Promise<Race | undefined> {
    const [race] = await db.select().from(races).where(eq(races.id, id));
    return race || undefined;
  }

  async getRaces(status?: string): Promise<Race[]> {
    if (status) {
      return await db.select().from(races).where(eq(races.status, status));
    }
    return await db.select().from(races);
  }

  async updateRaceStatus(id: number, status: string): Promise<void> {
    await db.update(races).set({ status }).where(eq(races.id, id));
  }

  async setRaceStartTime(id: number): Promise<void> {
    await db.update(races).set({ 
      status: 'active',
      startedAt: new Date()
    }).where(eq(races.id, id));
  }

  async setRaceFinishTime(id: number): Promise<void> {
    await db.update(races).set({ 
      status: 'finished',
      finishedAt: new Date()
    }).where(eq(races.id, id));
  }

  async addParticipant(insertParticipant: InsertRaceParticipant): Promise<RaceParticipant> {
    const [participant] = await db.insert(raceParticipants).values([insertParticipant]).returning();
    return participant;
  }

  async removeParticipant(raceId: number, playerId: string): Promise<void> {
    await db.delete(raceParticipants).where(
      and(
        eq(raceParticipants.raceId, raceId),
        eq(raceParticipants.playerId, playerId)
      )
    );
  }

  async getRaceParticipants(raceId: number): Promise<RaceParticipant[]> {
    return await db.select().from(raceParticipants).where(eq(raceParticipants.raceId, raceId));
  }

  async updateParticipantProgress(raceId: number, playerId: string, progress: number, wpm: number, accuracy: number, errors: number): Promise<void> {
    await db.update(raceParticipants).set({
      progress,
      wpm,
      accuracy,
      errors
    }).where(
      and(
        eq(raceParticipants.raceId, raceId),
        eq(raceParticipants.playerId, playerId)
      )
    );
  }

  async finishParticipant(raceId: number, playerId: string): Promise<void> {
    await db.update(raceParticipants).set({
      finished: true,
      finishedAt: new Date()
    }).where(
      and(
        eq(raceParticipants.raceId, raceId),
        eq(raceParticipants.playerId, playerId)
      )
    );
  }

  async updateParticipantRanks(raceId: number): Promise<void> {
    const participants = await this.getRaceParticipants(raceId);
    const finishedParticipants = participants
      .filter(p => p.finished)
      .sort((a, b) => (a.finishedAt?.getTime() || 0) - (b.finishedAt?.getTime() || 0));

    for (let i = 0; i < finishedParticipants.length; i++) {
      const participant = finishedParticipants[i];
      await db.update(raceParticipants).set({
        rank: i + 1
      }).where(
        and(
          eq(raceParticipants.raceId, raceId),
          eq(raceParticipants.playerId, participant.playerId)
        )
      );
    }
  }

  async getTextPassage(difficulty: string): Promise<TextPassage | undefined> {
    const passages = await db.select().from(textPassages).where(eq(textPassages.difficulty, difficulty));
    
    if (passages.length === 0) return undefined;
    
    // Return a random passage of the requested difficulty
    return passages[Math.floor(Math.random() * passages.length)];
  }

  async getAllTextPassages(): Promise<TextPassage[]> {
    return await db.select().from(textPassages);
  }

  async addTextPassage(insertPassage: InsertTextPassage): Promise<TextPassage> {
    const [passage] = await db.insert(textPassages).values([insertPassage]).returning();
    return passage;
  }
}

export const storage = new DatabaseStorage();