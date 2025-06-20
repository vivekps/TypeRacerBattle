import { races, raceParticipants, textPassages, type Race, type InsertRace, type RaceParticipant, type InsertRaceParticipant, type TextPassage, type InsertTextPassage } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private races: Map<number, Race> = new Map();
  private participants: Map<string, RaceParticipant> = new Map(); // key: raceId-playerId
  private textPassages: Map<number, TextPassage> = new Map();
  private currentRaceId = 1;
  private currentParticipantId = 1;
  private currentPassageId = 1;

  constructor() {
    // Initialize with some sample text passages
    this.initializeTextPassages();
  }

  private initializeTextPassages() {
    const passages = [
      {
        content: "The quick brown fox jumps over the lazy dog. This pangram sentence contains every letter of the alphabet at least once, making it a perfect test for typing speed and accuracy. Many typing programs use this sentence to help people practice their keyboard skills and improve their words per minute rate.",
        difficulty: "easy",
        length: 245
      },
      {
        content: "Programming is the art of telling another human being what one wants the computer to do. It requires logical thinking, problem-solving skills, and attention to detail. Modern software development involves many different technologies, frameworks, and methodologies that help developers create efficient and maintainable code.",
        difficulty: "medium",
        length: 312
      },
      {
        content: "Artificial intelligence and machine learning algorithms are revolutionizing the way we approach complex computational problems. These sophisticated systems can analyze vast amounts of data, identify patterns, and make predictions with remarkable accuracy. The implementation of neural networks, deep learning architectures, and statistical models has opened new possibilities in various domains including natural language processing, computer vision, and autonomous systems.",
        difficulty: "hard",
        length: 487
      }
    ];

    passages.forEach(passage => {
      const textPassage: TextPassage = {
        id: this.currentPassageId++,
        ...passage
      };
      this.textPassages.set(textPassage.id, textPassage);
    });
  }

  async createRace(insertRace: InsertRace): Promise<Race> {
    const textPassage = await this.getTextPassage(insertRace.difficulty || 'medium');
    if (!textPassage) {
      throw new Error(`No text passage found for difficulty: ${insertRace.difficulty || 'medium'}`);
    }

    const race: Race = {
      id: this.currentRaceId++,
      name: insertRace.name,
      textPassage: textPassage.content,
      maxPlayers: insertRace.maxPlayers || 4,
      difficulty: insertRace.difficulty || 'medium',
      timeLimit: insertRace.timeLimit || 180,
      status: "waiting",
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
    };
    
    this.races.set(race.id, race);
    return race;
  }

  async getRace(id: number): Promise<Race | undefined> {
    return this.races.get(id);
  }

  async getRaces(status?: string): Promise<Race[]> {
    const allRaces = Array.from(this.races.values());
    if (status) {
      return allRaces.filter(race => race.status === status);
    }
    return allRaces;
  }

  async updateRaceStatus(id: number, status: string): Promise<void> {
    const race = this.races.get(id);
    if (race) {
      race.status = status;
      this.races.set(id, race);
    }
  }

  async setRaceStartTime(id: number): Promise<void> {
    const race = this.races.get(id);
    if (race) {
      race.startedAt = new Date();
      race.status = "active";
      this.races.set(id, race);
    }
  }

  async setRaceFinishTime(id: number): Promise<void> {
    const race = this.races.get(id);
    if (race) {
      race.finishedAt = new Date();
      race.status = "finished";
      this.races.set(id, race);
    }
  }

  async addParticipant(insertParticipant: InsertRaceParticipant): Promise<RaceParticipant> {
    const participant: RaceParticipant = {
      id: this.currentParticipantId++,
      ...insertParticipant,
      progress: 0,
      wpm: 0,
      accuracy: 100,
      errors: 0,
      finished: false,
      finishedAt: null,
      rank: null,
    };
    
    const key = `${participant.raceId}-${participant.playerId}`;
    this.participants.set(key, participant);
    return participant;
  }

  async removeParticipant(raceId: number, playerId: string): Promise<void> {
    const key = `${raceId}-${playerId}`;
    this.participants.delete(key);
  }

  async getRaceParticipants(raceId: number): Promise<RaceParticipant[]> {
    return Array.from(this.participants.values())
      .filter(p => p.raceId === raceId);
  }

  async updateParticipantProgress(raceId: number, playerId: string, progress: number, wpm: number, accuracy: number, errors: number): Promise<void> {
    const key = `${raceId}-${playerId}`;
    const participant = this.participants.get(key);
    if (participant) {
      participant.progress = progress;
      participant.wpm = wpm;
      participant.accuracy = accuracy;
      participant.errors = errors;
      this.participants.set(key, participant);
    }
  }

  async finishParticipant(raceId: number, playerId: string): Promise<void> {
    const key = `${raceId}-${playerId}`;
    const participant = this.participants.get(key);
    if (participant) {
      participant.finished = true;
      participant.finishedAt = new Date();
      this.participants.set(key, participant);
    }
  }

  async updateParticipantRanks(raceId: number): Promise<void> {
    const participants = await this.getRaceParticipants(raceId);
    const finishedParticipants = participants
      .filter(p => p.finished)
      .sort((a, b) => (a.finishedAt?.getTime() || 0) - (b.finishedAt?.getTime() || 0));

    finishedParticipants.forEach((participant, index) => {
      participant.rank = index + 1;
      const key = `${participant.raceId}-${participant.playerId}`;
      this.participants.set(key, participant);
    });
  }

  async getTextPassage(difficulty: string): Promise<TextPassage | undefined> {
    const passages = Array.from(this.textPassages.values())
      .filter(p => p.difficulty === difficulty);
    
    if (passages.length === 0) return undefined;
    
    // Return a random passage of the requested difficulty
    return passages[Math.floor(Math.random() * passages.length)];
  }

  async getAllTextPassages(): Promise<TextPassage[]> {
    return Array.from(this.textPassages.values());
  }

  async addTextPassage(insertPassage: InsertTextPassage): Promise<TextPassage> {
    const passage: TextPassage = {
      id: this.currentPassageId++,
      ...insertPassage,
    };
    this.textPassages.set(passage.id, passage);
    return passage;
  }
}

export const storage = new MemStorage();
