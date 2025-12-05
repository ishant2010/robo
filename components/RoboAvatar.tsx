import React from 'react';

interface RoboAvatarProps {
  isSpeaking: boolean;
  isListening: boolean;
}

export const RoboAvatar: React.FC<RoboAvatarProps> = ({ isSpeaking, isListening }) => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center animate-float">
      {/* Glow Effect behind */}
      <div className={`absolute inset-0 bg-neon-blue rounded-full blur-[60px] opacity-20 transition-opacity duration-300 ${isSpeaking ? 'opacity-40' : ''}`}></div>

      {/* Head */}
      <div className="relative z-10 w-40 h-36 bg-gray-900 border-2 border-neon-blue rounded-3xl shadow-[0_0_15px_rgba(0,243,255,0.3)] flex flex-col items-center justify-center overflow-hidden">
        
        {/* Antenna */}
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-1 h-6 bg-gray-600"></div>
        <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_red] transition-colors duration-200 ${isListening ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : ''}`}></div>

        {/* Eyes Container */}
        <div className="flex space-x-6 mb-4 mt-2">
          {/* Left Eye */}
          <div className={`w-8 h-8 bg-neon-blue rounded-full shadow-[0_0_10px_#00f3ff] transition-all duration-100 ${isSpeaking ? 'scale-110' : 'scale-100'} ${isListening ? 'animate-pulse' : ''}`}>
             <div className="w-2 h-2 bg-white rounded-full ml-1 mt-1 opacity-80"></div>
          </div>
          {/* Right Eye */}
          <div className={`w-8 h-8 bg-neon-blue rounded-full shadow-[0_0_10px_#00f3ff] transition-all duration-100 ${isSpeaking ? 'scale-110' : 'scale-100'} ${isListening ? 'animate-pulse' : ''}`}>
             <div className="w-2 h-2 bg-white rounded-full ml-1 mt-1 opacity-80"></div>
          </div>
        </div>

        {/* Mouth Area */}
        <div className="w-24 h-8 bg-gray-800 rounded-lg flex items-center justify-center space-x-1 overflow-hidden">
            {isSpeaking ? (
                // Speaking Waveform
                <>
                  <div className="w-1 bg-neon-blue animate-[pulse_0.4s_ease-in-out_infinite] h-2"></div>
                  <div className="w-1 bg-neon-blue animate-[pulse_0.3s_ease-in-out_infinite] h-4"></div>
                  <div className="w-1 bg-neon-blue animate-[pulse_0.5s_ease-in-out_infinite] h-6"></div>
                  <div className="w-1 bg-neon-blue animate-[pulse_0.2s_ease-in-out_infinite] h-3"></div>
                  <div className="w-1 bg-neon-blue animate-[pulse_0.4s_ease-in-out_infinite] h-5"></div>
                </>
            ) : (
                // Idle Line
                <div className="w-16 h-0.5 bg-neon-blue opacity-50"></div>
            )}
        </div>
      </div>
      
      {/* Neck */}
      <div className="absolute top-[calc(50%+4rem)] w-12 h-6 bg-gray-800 rounded-b-lg border-x border-b border-gray-700"></div>

      {/* Shoulders Hint */}
      <div className="absolute top-[calc(50%+5rem)] w-56 h-12 bg-gradient-to-b from-gray-900 to-transparent rounded-t-full opacity-80"></div>
    </div>
  );
};