import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRank } from '@/lib/typing-utils';
import { Trophy, Medal, Home, RotateCcw, Share } from 'lucide-react';
import { type Race, type RaceParticipant } from '@shared/schema';

interface RaceResultsProps {
  race: Race;
  results: RaceParticipant[];
  currentPlayerId: string;
  onBackToLobby: () => void;
  onRaceAgain: () => void;
}

export function RaceResults({ race, results, currentPlayerId, onBackToLobby, onRaceAgain }: RaceResultsProps) {
  const sortedResults = [...results].sort((a, b) => {
    // Sort by rank first (lower rank = better position)
    if (a.rank !== null && b.rank !== null) {
      return a.rank - b.rank;
    }
    // If no rank, sort by progress
    return b.progress - a.progress;
  });

  const currentPlayer = results.find(p => p.playerId === currentPlayerId);
  const totalPlayers = results.length;
  const avgWPM = Math.round(results.reduce((sum, p) => sum + p.wpm, 0) / totalPlayers);

  const getRankIcon = (rank: number | null) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-400" />;
    return null;
  };

  const getRankColor = (rank: number | null) => {
    if (rank === 1) return 'bg-yellow-400 text-white';
    if (rank === 2) return 'bg-gray-400 text-white';
    if (rank === 3) return 'bg-orange-400 text-white';
    return 'bg-gray-300 text-gray-700';
  };

  const handleShare = async () => {
    const shareText = `I just finished a typing race on TypeRace Pro! 🎯\n\nMy results:\n• WPM: ${currentPlayer?.wpm}\n• Accuracy: ${currentPlayer?.accuracy}%\n• Rank: ${currentPlayer?.rank ? formatRank(currentPlayer.rank) : 'Not ranked'}\n\nJoin me for the next race!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TypeRace Pro Results',
          text: shareText,
        });
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareText);
      // Could show a toast here
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <h2 className="text-3xl font-light text-gray-900 mb-4">Race Results</h2>
        <p className="text-gray-600">Here's how everyone performed in this race</p>
      </div>

      {/* Final Rankings */}
      <Card>
        <CardHeader>
          <CardTitle>Final Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-200">
            {sortedResults.map((result) => {
              const isCurrentPlayer = result.playerId === currentPlayerId;
              const rank = result.rank || sortedResults.indexOf(result) + 1;
              
              return (
                <div
                  key={result.playerId}
                  className={`px-6 py-4 flex items-center space-x-4 ${
                    isCurrentPlayer ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankColor(result.rank)}`}>
                    {rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {isCurrentPlayer ? 'You' : result.playerName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {result.finished 
                        ? `Completed in ${Math.floor((result.finishedAt ? new Date(result.finishedAt).getTime() - new Date(race.startedAt!).getTime() : 0) / 1000)}s`
                        : 'Did not finish'
                      }
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-gray-900">{result.wpm} WPM</div>
                    <div className="text-sm text-gray-600">{result.accuracy}% accuracy</div>
                  </div>
                  {getRankIcon(result.rank)}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Personal Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {currentPlayer ? (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Final WPM:</span>
                  <span className="font-bold">{currentPlayer.wpm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Accuracy:</span>
                  <span className="font-bold">{currentPlayer.accuracy}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Errors:</span>
                  <span className="font-bold">{currentPlayer.errors}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-bold">
                    {Math.round((currentPlayer.progress / race.textPassage.length) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rank:</span>
                  <span className="font-bold text-blue-600">
                    {currentPlayer.rank ? formatRank(currentPlayer.rank) : 'Not ranked'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Performance data not available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Race Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Players:</span>
                <span className="font-bold">{totalPlayers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average WPM:</span>
                <span className="font-bold">{avgWPM}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Text Length:</span>
                <span className="font-bold">{race.textPassage.split(' ').length} words</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Race Duration:</span>
                <span className="font-bold">{race.timeLimit / 60} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Difficulty:</span>
                <span className="font-bold capitalize">{race.difficulty}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <Button onClick={onRaceAgain} className="bg-blue-600 hover:bg-blue-700">
          <RotateCcw className="w-4 h-4 mr-2" />
          Race Again
        </Button>
        <Button onClick={onBackToLobby} variant="secondary">
          <Home className="w-4 h-4 mr-2" />
          Back to Lobby
        </Button>
        <Button onClick={handleShare} variant="outline">
          <Share className="w-4 h-4 mr-2" />
          Share Results
        </Button>
      </div>
    </div>
  );
}
