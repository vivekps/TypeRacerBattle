import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateRaceModal } from './create-race-modal';
import { useWebSocket } from '@/hooks/use-websocket';
import { Plus, Zap, Dumbbell, Users, Clock, FileText } from 'lucide-react';
import { type Race } from '@shared/schema';

interface RaceSelectorProps {
  onJoinRace: (raceId: number, playerName: string) => void;
}

export function RaceSelector({ onJoinRace }: RaceSelectorProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const { connectionStatus } = useWebSocket();

  const { data: races, isLoading } = useQuery<Race[]>({
    queryKey: ['/api/races', { status: 'waiting' }],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  const handleJoinRace = (raceId: number) => {
    const name = playerName.trim() || `Player${Math.floor(Math.random() * 1000)}`;
    onJoinRace(raceId, name);
  };

  const handleCreateRace = (raceId: number) => {
    const name = playerName.trim() || `Player${Math.floor(Math.random() * 1000)}`;
    onJoinRace(raceId, name);
  };

  if (connectionStatus === 'disconnected') {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-light text-gray-900 mb-4">Connection Required</h2>
        <p className="text-gray-600">Please wait while we connect you to the server...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <h2 className="text-3xl font-light text-gray-900 mb-4">Join a Typing Race</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Compete against other typists in real-time races. Test your speed and accuracy!
        </p>
      </div>

      {/* Player Name Input */}
      <div className="max-w-md mx-auto">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Name (optional)
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
          placeholder="Enter your name"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 p-6 h-auto flex flex-col items-center space-y-3"
        >
          <Plus className="w-8 h-8" />
          <div>
            <div className="font-medium">Create New Race</div>
            <div className="text-sm opacity-90">Start your own room</div>
          </div>
        </Button>
        
        <Button
          variant="secondary"
          className="bg-green-600 hover:bg-green-700 text-white p-6 h-auto flex flex-col items-center space-y-3"
          onClick={() => {
            // Join the first available race
            if (races && races.length > 0) {
              handleJoinRace(races[0].id);
            }
          }}
          disabled={!races || races.length === 0}
        >
          <Zap className="w-8 h-8" />
          <div>
            <div className="font-medium">Quick Match</div>
            <div className="text-sm opacity-90">Join random race</div>
          </div>
        </Button>
        
        <Button
          variant="secondary"
          className="bg-gray-600 hover:bg-gray-700 text-white p-6 h-auto flex flex-col items-center space-y-3"
        >
          <Dumbbell className="w-8 h-8" />
          <div>
            <div className="font-medium">Practice Mode</div>
            <div className="text-sm opacity-90">Solo training</div>
          </div>
        </Button>
      </div>

      {/* Active Races List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900">Active Races</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : races && races.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {races.map((race) => (
                <div
                  key={race.id}
                  className="py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {/* TODO: Get actual participant count */}
                          0/{race.maxPlayers} players
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {race.timeLimit / 60}min
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 capitalize">
                          {race.difficulty}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {race.name}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleJoinRace(race.id)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Join Race
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No active races available. Create one to get started!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRaceModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onRaceCreated={handleCreateRace}
      />
    </div>
  );
}
