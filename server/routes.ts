import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertRaceSchema, insertRaceParticipantSchema, type WebSocketMessage, type Race, type RaceParticipant } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track WebSocket connections
  const connections = new Map<string, WebSocket>();
  const playerRaces = new Map<string, number>(); // playerId -> raceId
  
  // Generate unique player ID
  function generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
  
  // Broadcast to all players in a race
  function broadcastToRace(raceId: number, message: WebSocketMessage, excludePlayerId?: string) {
    for (const [playerId, connection] of connections) {
      if (playerRaces.get(playerId) === raceId && playerId !== excludePlayerId) {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(JSON.stringify(message));
        }
      }
    }
  }
  
  // Check if race should start
  async function checkRaceStart(raceId: number) {
    const race = await storage.getRace(raceId);
    const participants = await storage.getRaceParticipants(raceId);
    
    if (race && race.status === "waiting" && participants.length >= 2) {
      // Start race after 5 seconds if we have at least 2 players
      setTimeout(async () => {
        const currentRace = await storage.getRace(raceId);
        const currentParticipants = await storage.getRaceParticipants(raceId);
        
        if (currentRace && currentRace.status === "waiting" && currentParticipants.length >= 2) {
          await storage.setRaceStartTime(raceId);
          
          broadcastToRace(raceId, {
            type: 'race_started',
            data: { raceId }
          });
        }
      }, 5000);
    }
  }
  
  // Check if race is finished
  async function checkRaceFinish(raceId: number) {
    const race = await storage.getRace(raceId);
    const participants = await storage.getRaceParticipants(raceId);
    
    if (race && race.status === "active") {
      const finishedParticipants = participants.filter(p => p.finished);
      
      // End race if all participants finished or time limit exceeded
      const raceStartTime = race.startedAt?.getTime() || 0;
      const currentTime = Date.now();
      const timeElapsed = (currentTime - raceStartTime) / 1000;
      
      if (finishedParticipants.length === participants.length || timeElapsed >= race.timeLimit) {
        await storage.setRaceFinishTime(raceId);
        await storage.updateParticipantRanks(raceId);
        
        const results = await storage.getRaceParticipants(raceId);
        
        broadcastToRace(raceId, {
          type: 'race_finished',
          data: { raceId, results }
        });
      }
    }
  }
  
  wss.on('connection', (ws) => {
    const playerId = generatePlayerId();
    connections.set(playerId, ws);
    
    ws.on('message', async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join_race': {
            const { raceId, playerName } = message.data;
            
            // Check if race exists and is joinable
            const race = await storage.getRace(raceId);
            if (!race || race.status !== "waiting") {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Race not available for joining' }
              }));
              return;
            }
            
            // Check if race is full
            const participants = await storage.getRaceParticipants(raceId);
            if (participants.length >= race.maxPlayers) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Race is full' }
              }));
              return;
            }
            
            // Add participant
            const participant = await storage.addParticipant({
              raceId,
              playerId,
              playerName
            });
            
            playerRaces.set(playerId, raceId);
            
            // Broadcast to all players in race
            broadcastToRace(raceId, {
              type: 'player_joined',
              data: { raceId, participant }
            });
            
            // Send race update to new player
            const updatedParticipants = await storage.getRaceParticipants(raceId);
            ws.send(JSON.stringify({
              type: 'race_update',
              data: { race, participants: updatedParticipants }
            }));
            
            // Check if race should start
            await checkRaceStart(raceId);
            break;
          }
          
          case 'leave_race': {
            const { raceId } = message.data;
            
            await storage.removeParticipant(raceId, playerId);
            playerRaces.delete(playerId);
            
            broadcastToRace(raceId, {
              type: 'player_left',
              data: { raceId, playerId }
            });
            break;
          }
          
          case 'typing_update': {
            const { raceId, progress, wpm, accuracy, errors } = message.data;
            
            const race = await storage.getRace(raceId);
            if (!race || race.status !== "active") {
              return;
            }
            
            await storage.updateParticipantProgress(raceId, playerId, progress, wpm, accuracy, errors);
            
            // Check if player finished
            if (progress >= race.textPassage.length) {
              await storage.finishParticipant(raceId, playerId);
            }
            
            // Broadcast progress to all players
            const participants = await storage.getRaceParticipants(raceId);
            broadcastToRace(raceId, {
              type: 'race_update',
              data: { race, participants }
            });
            
            // Check if race is finished
            await checkRaceFinish(raceId);
            break;
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });
    
    ws.on('close', async () => {
      const raceId = playerRaces.get(playerId);
      if (raceId) {
        await storage.removeParticipant(raceId, playerId);
        broadcastToRace(raceId, {
          type: 'player_left',
          data: { raceId, playerId }
        });
      }
      
      connections.delete(playerId);
      playerRaces.delete(playerId);
    });
  });

  // REST API routes
  app.get("/api/races", async (req, res) => {
    try {
      const status = req.query.status as string;
      const races = await storage.getRaces(status);
      res.json(races);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch races" });
    }
  });

  app.post("/api/races", async (req, res) => {
    try {
      const raceData = insertRaceSchema.parse(req.body);
      const race = await storage.createRace(raceData);
      res.status(201).json(race);
    } catch (error) {
      res.status(400).json({ message: "Invalid race data" });
    }
  });

  app.get("/api/races/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const race = await storage.getRace(id);
      
      if (!race) {
        res.status(404).json({ message: "Race not found" });
        return;
      }
      
      const participants = await storage.getRaceParticipants(id);
      res.json({ race, participants });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch race" });
    }
  });

  app.get("/api/text-passages", async (req, res) => {
    try {
      const passages = await storage.getAllTextPassages();
      res.json(passages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch text passages" });
    }
  });

  return httpServer;
}
