
import React from 'react';

interface MicrophoneButtonProps {
  isActive: boolean;
  isConnecting: boolean;
  onClick: () => void;
}

export const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({ isActive, isConnecting, onClick }) => {
  const buttonClasses = `
    relative flex items-center justify-center w-20 h-20 rounded-full
    transition-all duration-300 ease-in-out focus:outline-none focus:ring-4
    ${isConnecting ? 'bg-yellow-500 text-white cursor-wait' : ''}
    ${isActive ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400' : ''}
    ${!isActive && !isConnecting ? 'bg-cyan-500 hover:bg-cyan-600 text-white focus:ring-cyan-300' : ''}
  `;

  return (
    <button onClick={onClick} disabled={isConnecting} className={buttonClasses} aria-label={isActive ? 'Stop Session' : 'Start Session'}>
      {isConnecting && (
        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!isConnecting && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm-1 4a4 4 0 108 0V4a4 4 0 10-8 0v4zM3 9a.75.75 0 00-.75.75v.5c0 3.53 2.61 6.437 6 6.92V18H6.75a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5H11v-1.83c3.39-.483 6-3.39 6-6.92v-.5A.75.75 0 0016.25 9H15a.75.75 0 000 1.5h.25a6.5 6.5 0 01-13 0H2.25a.75.75 0 000-1.5H3z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
};
