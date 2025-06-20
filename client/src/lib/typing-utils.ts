export interface TypingStats {
  wpm: number;
  accuracy: number;
  errors: number;
  progress: number;
}

export interface TextSegment {
  text: string;
  status: 'correct' | 'incorrect' | 'current' | 'pending';
}

export function calculateWPM(characters: number, timeInSeconds: number): number {
  if (timeInSeconds === 0) return 0;
  const words = characters / 5; // Standard: 5 characters = 1 word
  const minutes = timeInSeconds / 60;
  return Math.round(words / minutes);
}

export function calculateAccuracy(correctChars: number, totalChars: number): number {
  if (totalChars === 0) return 100;
  return Math.round((correctChars / totalChars) * 100);
}

export function analyzeText(originalText: string, typedText: string): {
  segments: TextSegment[];
  stats: TypingStats;
  startTime?: number;
} {
  const segments: TextSegment[] = [];
  let correctChars = 0;
  let errors = 0;
  
  const maxLength = Math.max(originalText.length, typedText.length);
  
  for (let i = 0; i < maxLength; i++) {
    const originalChar = originalText[i];
    const typedChar = typedText[i];
    
    if (i < typedText.length) {
      if (originalChar === typedChar) {
        segments.push({ text: originalChar, status: 'correct' });
        correctChars++;
      } else {
        segments.push({ text: originalChar, status: 'incorrect' });
        errors++;
      }
    } else if (i === typedText.length) {
      // Current character to type
      segments.push({ text: originalChar, status: 'current' });
    } else {
      // Remaining characters
      segments.push({ text: originalChar, status: 'pending' });
    }
  }
  
  const progress = typedText.length;
  const accuracy = calculateAccuracy(correctChars, typedText.length);
  
  return {
    segments,
    stats: {
      wpm: 0, // Will be calculated with time
      accuracy,
      errors,
      progress
    }
  };
}

export function groupSegmentsByWord(segments: TextSegment[]): TextSegment[][] {
  const words: TextSegment[][] = [];
  let currentWord: TextSegment[] = [];
  
  for (const segment of segments) {
    if (segment.text === ' ') {
      if (currentWord.length > 0) {
        words.push(currentWord);
        currentWord = [];
      }
      words.push([segment]); // Space as its own word
    } else {
      currentWord.push(segment);
    }
  }
  
  if (currentWord.length > 0) {
    words.push(currentWord);
  }
  
  return words;
}

export function getPlayerColor(index: number): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-orange-500'
  ];
  return colors[index % colors.length];
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatRank(rank: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = rank % 100;
  return rank + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}
