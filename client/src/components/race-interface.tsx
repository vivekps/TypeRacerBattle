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
  onRaceUpdate?: (data: { race: Race; participants: RaceParticipant[] }) => void;
}

export function RaceInterface({ race, participants, currentPlayerId, onLeaveRace }: RaceInterfaceProps) {
  const [typedText, setTypedText] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(race.timeLimit);
  const [raceStarted, setRaceStarted] = useState(race.status === 'active');
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Update race status when race prop changes
  useEffect(() => {
    console.log('Race status changed to:', race.status);
    if (race.status === 'active') {
      setRaceStarted(true);
      if (!startTime) {
        setStartTime(Date.now());
      }
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [race.status, startTime]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, addMessageHandler, removeMessageHandler } = useWebSocket();

  const currentParticipant = participants.find(p => p.playerId === currentPlayerId);
  const analysis = analyzeText(race.textPassage, typedText);

  useEffect(() => {
    const handleRaceStarted = () => {
      console.log('Race started event received');
      setRaceStarted(true);
      setStartTime(Date.now());
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    };

    const handleRaceUpdate = (data: { race: Race; participants: RaceParticipant[] }) => {
      console.log('Race update received in interface:', data.race.status, 'participants:', data.participants.map(p => ({ name: p.playerName, progress: p.progress, wpm: p.wpm })));
      // Trigger a re-render by updating the participants hash dependency
      if (data.race.status === 'active' && !raceStarted) {
        setRaceStarted(true);
        setStartTime(Date.now());
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
      // Force re-render by updating timestamp
      setLastUpdateTime(Date.now());
    };

    addMessageHandler('race_started', handleRaceStarted);
    addMessageHandler('race_update', handleRaceUpdate);

    return () => {
      removeMessageHandler('race_started');
      removeMessageHandler('race_update');
    };
  }, [addMessageHandler, removeMessageHandler, raceStarted]);

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

  // Send typing updates only when there's actual typing
  useEffect(() => {
    if (!raceStarted || !startTime || race.status !== 'active' || typedText.length === 0) return;

    const timeElapsed = (Date.now() - startTime) / 1000;
    const wpm = calculateWPM(analysis.stats.progress, timeElapsed);

    console.log('Sending typing update:', {
      progress: analysis.stats.progress,
      wpm,
      accuracy: analysis.stats.accuracy,
      errors: analysis.stats.errors,
      typedLength: typedText.length,
      timeElapsed
    });

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
  }, [typedText, raceStarted, startTime, race.id, race.status, sendMessage, analysis.stats]);

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
  
  // Add dependency to force re-render when participants change
  const participantsHash = participants.map(p => `${p.playerId}:${p.progress}:${p.wpm}`).join('|');
  
  // Use lastUpdateTime to force re-render
  const renderKey = `${participantsHash}-${lastUpdateTime}`;

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
          <div className="space-y-3" key={renderKey}>
            {sortedParticipants.map((participant, index) => {
              // Use local progress for current player, server progress for others
              const isCurrentPlayer = participant.playerId === currentPlayerId;
              const displayProgress = isCurrentPlayer ? analysis.stats.progress : participant.progress;
              const displayWpm = isCurrentPlayer ? (startTime ? calculateWPM(analysis.stats.progress, (Date.now() - startTime) / 1000) : 0) : participant.wpm;
              const displayAccuracy = isCurrentPlayer ? analysis.stats.accuracy : participant.accuracy;
              
              const progressPercentage = Math.min(100, Math.max(0, (displayProgress / race.textPassage.length) * 100));
              const colorClass = getPlayerColor(index);
              
              console.log(`RENDERING Player ${participant.playerName}: progress=${displayProgress}/${race.textPassage.length} = ${progressPercentage}% (local: ${isCurrentPlayer})`);
              
              return (
                <div key={`${participant.playerId}-${displayProgress}-${lastUpdateTime}`} className="flex items-center space-x-4">
                  <div className={`w-24 text-sm font-medium truncate ${isCurrentPlayer ? 'text-blue-600' : ''}`}>
                    {isCurrentPlayer ? 'You' : participant.playerName}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-3 relative">
                    <div
                      className={`h-3 rounded-full transition-all duration-200 ${colorClass}`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                    <Car
                      className={`absolute w-5 h-5 ${colorClass.replace('bg-', 'text-')}`}
                      style={{ left: `calc(${progressPercentage}% - 10px)`, top: '-4px' }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm font-medium">
                    {displayWpm} WPM
                  </div>
                  <div className="w-12 text-right text-sm text-gray-600">
                    {displayAccuracy}%
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
