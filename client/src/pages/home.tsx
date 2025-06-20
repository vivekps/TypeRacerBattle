import { useState, useEffect } from 'react';
import { RaceSelector } from '@/components/race-selector';
import { RaceInterface } from '@/components/race-interface';
import { RaceResults } from '@/components/race-results';
import { ConnectionStatus } from '@/components/connection-status';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { Keyboard, Users } from 'lucide-react';
import { type Race, type RaceParticipant } from '@shared/schema';

type GameState = 'lobby' | 'race' | 'results';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [currentRace, setCurrentRace] = useState<Race | null>(null);
  const [participants, setParticipants] = useState<RaceParticipant[]>([]);
  const [raceResults, setRaceResults] = useState<RaceParticipant[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [onlineUsers] = useState(1247); // This would come from the server in a real app
  
  const { sendMessage, addMessageHandler, removeMessageHandler } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    const handleRaceUpdate = (data: { race: Race; participants: RaceParticipant[] }) => {
      console.log('Race update received:', data.race.status, 'participants:', data.participants.length);
      setCurrentRace(data.race);
      setParticipants(data.participants);
      
      // Set current player ID from participants if not already set
      if (!currentPlayerId && data.participants.length > 0) {
        // Find the participant that was just added (should be the last one)
        const myParticipant = data.participants[data.participants.length - 1];
        setCurrentPlayerId(myParticipant.playerId);
        console.log('Set current player ID:', myParticipant.playerId);
      }
    };

    const handleRaceStarted = (data: { raceId: number }) => {
      toast({
        title: 'Race Started!',
        description: 'The race has begun. Start typing!',
      });
    };

    const handleRaceFinished = (data: { raceId: number; results: RaceParticipant[] }) => {
      setRaceResults(data.results);
      setGameState('results');
      toast({
        title: 'Race Finished!',
        description: 'Check out the results!',
      });
    };

    const handlePlayerJoined = (data: { raceId: number; participant: RaceParticipant }) => {
      toast({
        title: 'Player Joined',
        description: `${data.participant.playerName} joined the race`,
      });
    };

    const handlePlayerLeft = (data: { raceId: number; playerId: string }) => {
      toast({
        title: 'Player Left',
        description: 'A player left the race',
      });
    };

    const handleError = (data: { message: string }) => {
      toast({
        title: 'Error',
        description: data.message,
        variant: 'destructive',
      });
    };

    addMessageHandler('race_update', handleRaceUpdate);
    addMessageHandler('race_started', handleRaceStarted);
    addMessageHandler('race_finished', handleRaceFinished);
    addMessageHandler('player_joined', handlePlayerJoined);
    addMessageHandler('player_left', handlePlayerLeft);
    addMessageHandler('error', handleError);

    return () => {
      removeMessageHandler('race_update');
      removeMessageHandler('race_started');
      removeMessageHandler('race_finished');
      removeMessageHandler('player_joined');
      removeMessageHandler('player_left');
      removeMessageHandler('error');
    };
  }, [addMessageHandler, removeMessageHandler, toast]);

  const handleJoinRace = (raceId: number, playerName: string) => {
    sendMessage({
      type: 'join_race',
      data: { raceId, playerName }
    });
    
    setGameState('race');
  };

  const handleLeaveRace = () => {
    if (currentRace) {
      sendMessage({
        type: 'leave_race',
        data: { raceId: currentRace.id }
      });
    }
    
    setGameState('lobby');
    setCurrentRace(null);
    setParticipants([]);
    setRaceResults([]);
    setCurrentPlayerId('');
  };

  const handleBackToLobby = () => {
    setGameState('lobby');
    setCurrentRace(null);
    setParticipants([]);
    setRaceResults([]);
    setCurrentPlayerId('');
  };

  const handleRaceAgain = () => {
    handleBackToLobby();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-6xl">
          <div className="flex items-center space-x-3">
            <Keyboard className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-medium text-gray-900">TypeRace Pro</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Users className="w-4 h-4 text-green-500" />
              <span>{onlineUsers.toLocaleString()} online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {gameState === 'lobby' && (
          <RaceSelector onJoinRace={handleJoinRace} />
        )}
        
        {gameState === 'race' && currentRace && (
          <RaceInterface
            race={currentRace}
            participants={participants}
            currentPlayerId={currentPlayerId}
            onLeaveRace={handleLeaveRace}
          />
        )}
        
        {gameState === 'results' && currentRace && (
          <RaceResults
            race={currentRace}
            results={raceResults}
            currentPlayerId={currentPlayerId}
            onBackToLobby={handleBackToLobby}
            onRaceAgain={handleRaceAgain}
          />
        )}
      </main>

      {/* Connection Status */}
      <ConnectionStatus />
    </div>
  );
}
