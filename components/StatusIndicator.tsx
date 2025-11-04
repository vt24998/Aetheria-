
import React from 'react';

interface StatusIndicatorProps {
  isConnecting: boolean;
  isActive: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isConnecting, isActive }) => {
  let text = 'Inactive';
  let color = 'bg-gray-500';

  if (isConnecting) {
    text = 'Connecting...';
    color = 'bg-yellow-500';
  } else if (isActive) {
    text = 'Active';
    color = 'bg-green-500';
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-300">
      <div className={`w-3 h-3 rounded-full ${color} ${isActive || isConnecting ? 'animate-pulse' : ''}`}></div>
      <span>{text}</span>
    </div>
  );
};
