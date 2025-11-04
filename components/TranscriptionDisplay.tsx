import React, { useEffect, useRef } from 'react';
import type { TranscriptionTurn } from '../types';

interface TranscriptionDisplayProps {
  history: TranscriptionTurn[];
  currentInput: string;
  currentOutput: string;
}

const Turn: React.FC<{ turn: TranscriptionTurn }> = ({ turn }) => {
  const isUser = turn.speaker === 'You';
  return (
    <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className="font-bold text-sm mb-1 text-gray-400">{turn.speaker}</div>
      <div className={`p-3 rounded-lg max-w-xl ${isUser ? 'bg-cyan-600/50 text-white' : 'bg-gray-700/50 text-gray-200'}`}>
        <p>{turn.text}</p>
      </div>
    </div>
  );
};

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ history, currentInput, currentOutput }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, currentInput, currentOutput]);

  const hasHistory = history.length > 0;
  const hasCurrentText = currentInput || currentOutput;

  if (!hasHistory && !hasCurrentText) {
    return null; // Don't render anything if there's no text yet
  }
  
  return (
    <div ref={scrollRef} className="flex-grow overflow-y-auto pr-2">
      {history.map((turn, index) => (
        <Turn key={index} turn={turn} />
      ))}
      {currentInput && (
        <div className="flex flex-col mb-4 items-end">
          <div className="font-bold text-sm mb-1 text-gray-400">You</div>
          <div className="p-3 rounded-lg max-w-xl bg-cyan-600/20 text-gray-300 italic">
            <p>{currentInput}</p>
          </div>
        </div>
      )}
      {currentOutput && (
        <div className="flex flex-col mb-4 items-start">
          <div className="font-bold text-sm mb-1 text-gray-400">Aetheria</div>
          <div className="p-3 rounded-lg max-w-xl bg-gray-700/20 text-gray-300 italic">
            <p>{currentOutput}</p>
          </div>
        </div>
      )}
    </div>
  );
};