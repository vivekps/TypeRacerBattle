import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { insertRaceSchema, insertRaceParticipantSchema, type WebSocketMessage, type Race, type RaceParticipant } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Socket.IO server setup
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  // Track connections and player data
  const playerRaces = new Map<string, number>(); // socketId -> raceId
  const playerIds = new Map<string, string>(); // socketId -> playerId
  const playerNames = new Map<string, string>(); // socketId -> playerName
  const socketsByRace = new Map<number, Set<string>>(); // raceId -> Set of socketIds
  
  // Generate unique player ID
  function generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
  
  // Broadcast to all players in a race
  function broadcastToRace(raceId: number, message: any, excludeSocketId?: string) {
    let sentCount = 0;
    const socketsInRace = socketsByRace.get(raceId) || new Set();
    
    socketsInRace.forEach(socketId => {
      if (socketId !== excludeSocketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          console.log(`Sending ${message.type} to socket ${socketId} for race ${raceId}`);
          socket.emit('message', message);
          sentCount++;
        } else {
          // Clean up stale socket references
          socketsInRace.delete(socketId);
          playerRaces.delete(socketId);
          playerIds.delete(socketId);
          playerNames.delete(socketId);
        }
      }
    });
    
    console.log(`Broadcast complete: sent ${message.type} to ${sentCount} clients`);
  }
  
  // Check if race should start
  async function checkRaceStart(raceId: number) {
    const race = await storage.getRace(raceId);
    const participants = await storage.getRaceParticipants(raceId);
    
    console.log(`Checking race start: Race ${raceId}, status: ${race?.status}, participants: ${participants.length}`);
    
    if (race && race.status === "waiting" && participants.length >= 2) {
      console.log(`Starting race ${raceId} in 5 seconds with ${participants.length} players`);
      // Start race after 5 seconds if we have at least 2 players
      setTimeout(async () => {
        const currentRace = await storage.getRace(raceId);
        const currentParticipants = await storage.getRaceParticipants(raceId);
        
        if (currentRace && currentRace.status === "waiting" && currentParticipants.length >= 2) {
          console.log(`Actually starting race ${raceId}`);
          await storage.setRaceStartTime(raceId);
          
          const updatedRace = await storage.getRace(raceId);
          
          broadcastToRace(raceId, {
            type: 'race_started',
            data: { raceId }
          });
          
          // Send updated race data
          broadcastToRace(raceId, {
            type: 'race_update',
            data: { race: updatedRace!, participants: currentParticipants }
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
      
      // Only end race if we have participants and they're all finished, or time limit exceeded
      if ((participants.length > 0 && finishedParticipants.length === participants.length) || timeElapsed >= race.timeLimit) {
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
  
  io.on('connection', (socket) => {
    const playerId = generatePlayerId();
    playerIds.set(socket.id, playerId);
    console.log(`Socket connected: ${playerId} (${socket.id})`);
    
    socket.on('message', async (message: WebSocketMessage) => {
      const currentPlayerId = playerIds.get(socket.id) || playerId;
      try {
        
        switch (message.type) {
          case 'join_race': {
            const { raceId, playerName } = message.data;
            console.log(`Player ${currentPlayerId} (${playerName}) attempting to join race ${raceId}`);
            
            // Check if race exists and is joinable
            const race = await storage.getRace(raceId);
            if (!race || race.status !== "waiting") {
              console.log(`Race ${raceId} not available: ${race ? race.status : 'not found'}`);
              socket.emit('message', {
                type: 'error',
                data: { message: 'Race not available for joining' }
              });
              return;
            }
            
            // Check if race is full
            const participants = await storage.getRaceParticipants(raceId);
            if (participants.length >= race.maxPlayers) {
              socket.emit('message', {
                type: 'error',
                data: { message: 'Race is full' }
              });
              return;
            }
            
            // Add participant
            const participant = await storage.addParticipant({
              raceId,
              playerId: currentPlayerId,
              playerName
            });
            
            // Track all player data
            playerRaces.set(socket.id, raceId);
            playerNames.set(socket.id, playerName);
            
            // Add socket to race tracking
            if (!socketsByRace.has(raceId)) {
              socketsByRace.set(raceId, new Set());
            }
            socketsByRace.get(raceId)!.add(socket.id);
            
            console.log(`Player ${currentPlayerId} (${playerName}) added to race ${raceId}`);
            
            // Send race update to new player first
            const updatedParticipants = await storage.getRaceParticipants(raceId);
            socket.emit('message', {
              type: 'race_update',
              data: { race, participants: updatedParticipants }
            });
            
            // Broadcast to all other players in race
            broadcastToRace(raceId, {
              type: 'player_joined',
              data: { raceId, participant }
            }, socket.id);
            
            // Broadcast updated race state to all players
            broadcastToRace(raceId, {
              type: 'race_update',
              data: { race, participants: updatedParticipants }
            });
            
            console.log(`Race ${raceId} now has ${updatedParticipants.length} participants`);
            
            // Check if race should start
            await checkRaceStart(raceId);
            break;
          }
          
          case 'leave_race': {
            const { raceId } = message.data;
            
            await storage.removeParticipant(raceId, currentPlayerId);
            
            // Clean up all tracking data
            playerRaces.delete(socket.id);
            playerNames.delete(socket.id);
            const socketsInRace = socketsByRace.get(raceId);
            if (socketsInRace) {
              socketsInRace.delete(socket.id);
              if (socketsInRace.size === 0) {
                socketsByRace.delete(raceId);
              }
            }
            
            broadcastToRace(raceId, {
              type: 'player_left',
              data: { raceId, playerId: currentPlayerId }
            });
            break;
          }
          
          case 'typing_update': {
            const { raceId, progress, wpm, accuracy, errors } = message.data;
            console.log(`Typing update from ${currentPlayerId}: progress=${progress}, wpm=${wpm}, accuracy=${accuracy}`);
            
            const race = await storage.getRace(raceId);
            if (!race || race.status !== "active") {
              console.log(`Typing update rejected: race status is ${race?.status}`);
              return;
            }
            
            try {
              // Update participant progress in storage
              await storage.updateParticipantProgress(raceId, currentPlayerId, progress, wpm, accuracy, errors);
              console.log(`Successfully updated progress for ${currentPlayerId}: ${progress} chars, ${wpm} WPM`);
              
              // Check if player finished
              if (progress >= race.textPassage.length) {
                await storage.finishParticipant(raceId, currentPlayerId);
                console.log(`Player ${currentPlayerId} finished the race`);
              }
              
              // Get updated participants and broadcast to all players
              const participants = await storage.getRaceParticipants(raceId);
              const updatedRace = await storage.getRace(raceId);
              
              console.log(`Broadcasting race update to ${participants.length} participants. Updated progress: ${participants.map(p => `${p.playerName}:${p.progress} chars, ${p.wpm} WPM`).join(', ')}`);
              
              broadcastToRace(raceId, {
                type: 'race_update',
                data: { race: updatedRace, participants }
              });
              
              // Check if race is finished
              await checkRaceFinish(raceId);
            } catch (error) {
              console.error('Error updating participant progress:', error);
            }
            break;
          }
        }
      } catch (error) {
        console.error('Socket message error:', error);
        socket.emit('message', {
          type: 'error',
          data: { message: 'Invalid message format' }
        });
      }
    });
    
    socket.on('disconnect', async () => {
      const raceId = playerRaces.get(socket.id);
      const currentPlayerId = playerIds.get(socket.id);
      
      if (raceId && currentPlayerId) {
        await storage.removeParticipant(raceId, currentPlayerId);
        broadcastToRace(raceId, {
          type: 'player_left',
          data: { raceId, playerId: currentPlayerId }
        });
      }
      
      // Clean up all tracking data
      playerRaces.delete(socket.id);
      playerIds.delete(socket.id);
      playerNames.delete(socket.id);
      
      // Remove from race socket tracking
      if (raceId) {
        const socketsInRace = socketsByRace.get(raceId);
        if (socketsInRace) {
          socketsInRace.delete(socket.id);
          if (socketsInRace.size === 0) {
            socketsByRace.delete(raceId);
          }
        }
      }
      
      console.log(`Socket disconnected: ${currentPlayerId || playerId} (${socket.id})`);
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
