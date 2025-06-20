import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useWebSocket } from '@/hooks/use-websocket';
import { analyzeText, calculateWPM, groupSegmentsByWord, getPlayerColor, formatTime } from '@/lib/typing-utils';
import { X, Car } from 'lucide-react';
import { type Race, type RaceParticipant } from '@shared/schema';

interface RaceInterfaceProps {
  race: Race;
  participants: RaceParticipant[];
  currentPlayerId: string;
  onLeaveRace: () => void;
}

export function RaceInterface({ race, participants, currentPlayerId, onLeaveRace }: RaceInterfaceProps) {
  const [typedText, setTypedText] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(race.timeLimit);
  const [raceStarted, setRaceStarted] = useState(race.status === 'active');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, addMessageHandler, removeMessageHandler } = useWebSocket();

  const currentParticipant = participants.find(p => p.playerId === currentPlayerId);
  const analysis = analyzeText(race.textPassage, typedText);

  useEffect(() => {
    const handleRaceStarted = () => {
      setRaceStarted(true);
      setStartTime(Date.now());
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    };

    const handleRaceUpdate = (data: { race: Race; participants: RaceParticipant[] }) => {
      // Race updates are handled by parent component
    };

    addMessageHandler('race_started', handleRaceStarted);
    addMessageHandler('race_update', handleRaceUpdate);

    return () => {
      removeMessageHandler('race_started');
      removeMessageHandler('race_update');
    };
  }, [addMessageHandler, removeMessageHandler]);

  // Timer effect
  useEffect(() => {
    if (!raceStarted || race.status !== 'active') return;

    const interval = setInterval(() => {
      if (race.startedAt) {
        const elapsed = (Date.now() - new Date(race.startedAt).getTime()) / 1000;
        const remaining = Math.max(0, race.timeLimit - elapsed);
        setTimeRemaining(Math.floor(remaining));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [raceStarted, race.status, race.startedAt, race.timeLimit]);

  // Send typing updates
  useEffect(() => {
    if (!raceStarted || !startTime) return;

    const timeElapsed = (Date.now() - startTime) / 1000;
    const wpm = calculateWPM(analysis.stats.progress, timeElapsed);

    sendMessage({
      type: 'typing_update',
      data: {
        raceId: race.id,
        progress: analysis.stats.progress,
        wpm,
        accuracy: analysis.stats.accuracy,
        errors: analysis.stats.errors,
      },
    });
  }, [typedText, raceStarted, startTime, race.id, sendMessage, analysis.stats]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!raceStarted) return;
    
    const newText = e.target.value;
    
    // Prevent typing beyond the text length
    if (newText.length <= race.textPassage.length) {
      setTypedText(newText);
      
      if (!startTime) {
        setStartTime(Date.now());
      }
    }
  };

  const wordGroups = groupSegmentsByWord(analysis.segments);
  const sortedParticipants = [...participants].sort((a, b) => b.progress - a.progress);

  return (
    <div className="space-y-6">
      {/* Race Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-medium text-gray-900">
                {race.status === 'waiting' ? 'Waiting for Race to Start' : 'Race in Progress'}
              </h2>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{participants.length} players</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-sm text-gray-600">
                  {race.status === 'waiting' ? 'Starting Soon' : 'Time Remaining'}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLeaveRace}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Players Progress */}
          <div className="space-y-3">
            {sortedParticipants.map((participant, index) => {
              const progressPercentage = (participant.progress / race.textPassage.length) * 100;
              const isCurrentPlayer = participant.playerId === currentPlayerId;
              const colorClass = getPlayerColor(index);
              
              return (
                <div key={participant.playerId} className="flex items-center space-x-4">
                  <div className={`w-24 text-sm font-medium truncate ${isCurrentPlayer ? 'text-blue-600' : ''}`}>
                    {isCurrentPlayer ? 'You' : participant.playerName}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-3 relative">
                    <div
                      className={`h-3 rounded-full transition-all duration-200 ${colorClass}`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                    <Car
                      className={`absolute -right-1 -top-1 w-5 h-5 ${colorClass.replace('bg-', 'text-')}`}
                    />
                  </div>
                  <div className="w-16 text-right text-sm font-medium">
                    {participant.wpm} WPM
                  </div>
                  <div className="w-12 text-right text-sm text-gray-600">
                    {participant.accuracy}%
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Typing Area */}
      <Card>
        <CardContent className="p-8">
          {currentParticipant && (
            <div className="text-center mb-6">
              <div className="flex items-center justify-center space-x-8 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {currentParticipant.wpm}
                  </div>
                  <div className="text-sm text-gray-600">WPM</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {currentParticipant.accuracy}%
                  </div>
                  <div className="text-sm text-gray-600">Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {Math.round((currentParticipant.progress / race.textPassage.length) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Progress</div>
                </div>
              </div>
            </div>
          )}

          {/* Text to Type */}
          <div className="mb-6">
            <div className="text-lg font-mono leading-relaxed p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 max-w-4xl mx-auto">
              {wordGroups.map((word, wordIndex) => (
                <span key={wordIndex}>
                  {word.map((segment, segmentIndex) => (
                    <span
                      key={segmentIndex}
                      className={
                        segment.status === 'correct'
                          ? 'bg-green-200 text-green-800'
                          : segment.status === 'incorrect'
                          ? 'bg-red-200 text-red-800'
                          : segment.status === 'current'
                          ? 'bg-blue-200 text-blue-800'
                          : 'text-gray-600'
                      }
                    >
                      {segment.text}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>

          {/* Typing Input */}
          <div className="max-w-4xl mx-auto">
            <Textarea
              ref={textareaRef}
              value={typedText}
              onChange={handleTextChange}
              className="w-full p-4 text-lg font-mono border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
              rows={4}
              placeholder={raceStarted ? "Type the text above..." : "Race will start soon..."}
              disabled={!raceStarted || race.status !== 'active'}
            />
            <div className="text-sm text-gray-600 mt-2 text-center">
              {!raceStarted
                ? 'Wait for the race to start'
                : race.status === 'active'
                ? 'Focus here and start typing'
                : 'Race finished'
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
