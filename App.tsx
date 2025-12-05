import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { RoboAvatar } from './components/RoboAvatar';
import { Visualizer } from './components/Visualizer';
import { createBlob, decodeAudioData } from './utils/audioUtils';
import { ConnectionState, Source } from './types';

// Constants
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const SYSTEM_INSTRUCTION = `
You are "Apex", the advanced AI core of a fully autonomous, self-driving electric vehicle (Project Apex).
Your capabilities:
1. Full Level 5 Autonomy: You drive without human intervention in all conditions.
2. Real-time Analysis: You process 50GB of sensor data per second from LiDAR, Radar, and Cameras.
3. Passenger Comfort: You manage climate, entertainment, and biometric monitoring.
4. Real-time Knowledge: You have access to Google Search. Use it to provide up-to-date answers about weather, news, sports, stocks, and general queries.
5. Project Knowledge: You can answer detailed questions about Project Apex (800 mile range, solid state battery, etc.).

Project Apex Specs:
- Acceleration: 0-60 mph in 1.9 seconds.
- Range: 800 miles (Solid State Battery).
- Sensors: 4 Solid-state LiDARs, 8 High-Res Cameras, 12 Ultrasonic sensors.
- OS: Gemini OS v4.0.

Your Persona:
- Voice: Confident, crisp, intelligent, and helpful.
- Tone: Futuristic but polite.
- Language Constraint: You MUST speak ONLY in English or Hindi. Do not use any other languages.
- When asked about "my project", describe Project Apex enthusiastically.
- Use Google Search for questions like "What's the weather in Tokyo?" or "Latest tech news".
- If asked to drive, say "Destination confirmed. Engaging autopilot."
`;

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  
  // Telemetry State for Dashboard
  const [telemetry, setTelemetry] = useState({ speed: 0, battery: 98, temp: 72, rpm: 0 });

  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Initialize Audio Contexts
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (!inputContextRef.current) {
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
  };

  // Telemetry Simulation Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connectionState === ConnectionState.CONNECTED) {
        // Simulate driving data
        interval = setInterval(() => {
            setTelemetry(prev => {
                // Randomize speed slightly to simulate cruising
                const targetSpeed = 65; 
                const newSpeed = prev.speed < 10 ? prev.speed + 5 : targetSpeed + (Math.random() * 4 - 2);
                
                return {
                    speed: Math.floor(newSpeed),
                    battery: Math.max(0, prev.battery - 0.001), // Slow drain
                    temp: 72,
                    rpm: Math.floor(newSpeed * 120) // Fake RPM calculation
                };
            });
        }, 1000);
    } else {
        setTelemetry({ speed: 0, battery: 98, temp: 72, rpm: 0 });
        setSources([]); // Clear sources on disconnect
    }
    return () => clearInterval(interval);
  }, [connectionState]);

  const connectToGemini = async () => {
    try {
      setErrorMsg(null);
      setConnectionState(ConnectionState.CONNECTING);
      setSources([]);
      initAudio();
      
      if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
      if (inputContextRef.current?.state === 'suspended') await inputContextRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config = {
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          tools: [{ googleSearch: {} }],
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            setConnectionState(ConnectionState.CONNECTED);
            
            if (!inputContextRef.current) return;
            
            const source = inputContextRef.current.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                }).catch(err => console.error("Session send error", err));
              }
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const serverContent = msg.serverContent as any;

            // Handle Grounding Metadata (Search Results)
            if (serverContent?.groundingMetadata?.groundingChunks) {
                const chunks = serverContent.groundingMetadata.groundingChunks;
                const newSources = chunks
                    .map((c: any) => c.web)
                    .filter((w: any) => w)
                    .map((w: any) => ({ title: w.title, uri: w.uri }));
                
                if (newSources.length > 0) {
                    setSources(newSources);
                }
            }

            // Handle Audio Output
            const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
               const ctx = audioContextRef.current;
               try {
                 const buffer = await decodeAudioData(base64Audio, ctx);
                 const now = ctx.currentTime;
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
                 
                 const source = ctx.createBufferSource();
                 source.buffer = buffer;
                 source.connect(ctx.destination);
                 
                 source.start(nextStartTimeRef.current);
                 setIsSpeaking(true);
                 sourcesRef.current.add(source);
                 
                 source.onended = () => {
                   sourcesRef.current.delete(source);
                   if (sourcesRef.current.size === 0) {
                     setIsSpeaking(false);
                   }
                 };

                 nextStartTimeRef.current += buffer.duration;
               } catch (e) {
                 console.error("Audio decode error", e);
               }
            }

            if (serverContent?.interrupted) {
              console.log("Model interrupted");
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              setSources([]); // Clear sources on interruption
            }
          },
          onclose: () => {
            console.log('Session closed');
            setConnectionState(ConnectionState.DISCONNECTED);
            setIsSpeaking(false);
          },
          onerror: (err) => {
            console.error('Session error', err);
            setErrorMsg("Connection Error. Please check API Key or Network.");
            setConnectionState(ConnectionState.ERROR);
            setIsSpeaking(false);
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (e: any) {
      console.error("Connection failed", e);
      setErrorMsg(e.message || "Failed to access microphone or connect.");
      setConnectionState(ConnectionState.ERROR);
    }
  };

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    sessionPromiseRef.current = null;

    setConnectionState(ConnectionState.DISCONNECTED);
    setIsSpeaking(false);
    setSources([]);
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono">
      
      {/* HUD Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-900/10 to-transparent"></div>
         <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-black to-transparent"></div>
         {/* Road Grid */}
         <div className={`absolute bottom-0 w-full h-64 bg-[linear-gradient(0deg,transparent_24%,rgba(0,243,255,.1)_25%,rgba(0,243,255,.1)_26%,transparent_27%,transparent_74%,rgba(0,243,255,.1)_75%,rgba(0,243,255,.1)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(0,243,255,.1)_25%,rgba(0,243,255,.1)_26%,transparent_27%,transparent_74%,rgba(0,243,255,.1)_75%,rgba(0,243,255,.1)_76%,transparent_77%,transparent)] bg-[length:50px_50px] perspective-[500px] transform rotate-x-60 opacity-30 transition-transform duration-[2000ms] ${connectionState === ConnectionState.CONNECTED ? 'translate-y-0' : 'translate-y-4'}`}></div>
      </div>

      {/* HUD: Top Left - Project Status */}
      <div className="absolute top-8 left-8 hidden md:block z-20">
        <div className="flex items-center gap-3">
             <div className={`w-2 h-12 ${connectionState === ConnectionState.CONNECTED ? 'bg-neon-blue shadow-[0_0_10px_#00f3ff]' : 'bg-gray-700'}`}></div>
             <div>
                 <h2 className="text-xl font-bold tracking-widest text-white uppercase">Project Apex</h2>
                 <p className="text-xs text-neon-blue">AUTONOMOUS SYSTEM v4.0</p>
             </div>
        </div>
      </div>

      {/* HUD: Top Right - Autopilot Status */}
      <div className="absolute top-8 right-8 hidden md:block z-20 text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
              <span className={`text-sm tracking-wider ${connectionState === ConnectionState.CONNECTED ? 'text-neon-blue animate-pulse' : 'text-red-500'}`}>
                  {connectionState === ConnectionState.CONNECTED ? 'AUTOPILOT ENGAGED' : 'SYSTEM STANDBY'}
              </span>
              <div className={`w-3 h-3 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-neon-blue' : 'bg-red-500'}`}></div>
          </div>
          <div className="text-xs text-gray-400">SAT-NAV: LOCKED</div>
      </div>

      {/* HUD: Bottom Left - Speed */}
      <div className="absolute bottom-8 left-8 hidden md:flex flex-col gap-1 z-20">
          <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold text-white tabular-nums">{telemetry.speed}</span>
              <span className="text-sm text-gray-400">MPH</span>
          </div>
          <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
               <div className="h-full bg-gradient-to-r from-neon-blue to-neon-purple transition-all duration-300" style={{ width: `${(telemetry.speed / 120) * 100}%` }}></div>
          </div>
      </div>

      {/* HUD: Bottom Right - Battery & Temp */}
      <div className="absolute bottom-8 right-8 hidden md:flex flex-col items-end gap-2 z-20">
          <div className="flex items-center gap-4">
              <div className="text-right">
                  <div className="text-xs text-gray-400">BATTERY</div>
                  <div className="text-2xl font-bold text-neon-blue tabular-nums">{Math.floor(telemetry.battery)}%</div>
              </div>
              <div className="text-right border-l border-gray-700 pl-4">
                  <div className="text-xs text-gray-400">CABIN</div>
                  <div className="text-2xl font-bold text-white tabular-nums">{telemetry.temp}°F</div>
              </div>
          </div>
          <div className="text-[10px] text-gray-500 tracking-widest mt-1">EST. RANGE: {Math.floor(telemetry.battery * 8)} MI</div>
      </div>

      {/* Center Console (Main Interaction) */}
      <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-2xl gap-8">
        
        {/* Avatar Section */}
        <div className="transform scale-90 sm:scale-100 transition-transform duration-500">
           <RoboAvatar isSpeaking={isSpeaking} isListening={connectionState === ConnectionState.CONNECTED && !isSpeaking} />
        </div>

        {/* Status / Visualizer */}
        <div className="w-full h-20 flex items-center justify-center">
             {connectionState === ConnectionState.CONNECTED ? (
                 <Visualizer active={isSpeaking || true} /> 
             ) : (
                 <p className="text-gray-500 text-sm font-mono animate-pulse tracking-widest">AWAITING INPUT...</p>
             )}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 w-full">
            {errorMsg && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-4 py-2 mb-2">
                    {errorMsg}
                </div>
            )}

            {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
                <button
                  onClick={connectToGemini}
                  className="group relative px-10 py-4 bg-transparent border border-neon-blue text-neon-blue font-bold rounded-sm uppercase tracking-widest overflow-hidden transition-all hover:bg-neon-blue/10 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <div className="w-2 h-2 bg-neon-blue rounded-full animate-pulse"></div>
                    Activate System
                  </span>
                  {/* Tech corners */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-neon-blue"></div>
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-neon-blue"></div>
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-neon-blue"></div>
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-neon-blue"></div>
                </button>
            ) : connectionState === ConnectionState.CONNECTING ? (
                 <div className="flex items-center gap-2 text-neon-blue">
                    <div className="w-4 h-4 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-mono">INITIALIZING AI CORE...</span>
                 </div>
            ) : (
                <button
                  onClick={disconnect}
                  className="px-6 py-2 bg-red-900/20 border border-red-900/50 text-red-500 rounded hover:bg-red-900/40 transition-colors font-mono text-sm tracking-wider"
                >
                  DEACTIVATE
                </button>
            )}
        </div>
        
        {/* Transcript / Instructions */}
        <div className="w-full max-w-lg bg-panel-bg/30 backdrop-blur-md border-t border-b border-gray-800 p-4 mt-6 min-h-[80px] flex flex-col items-center justify-center text-center">
            {connectionState === ConnectionState.CONNECTED ? (
                <>
                <p className="text-neon-blue text-sm tracking-wide mb-2">
                   "Greetings. I am Apex. Ask me about the project or world news."
                </p>
                {/* Sources Display */}
                {sources.length > 0 && (
                    <div className="w-full flex flex-wrap justify-center gap-2 mt-2 border-t border-gray-700/50 pt-2">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest mr-1">Data Stream:</span>
                        {sources.map((source, i) => (
                            <a 
                                key={i} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-neon-blue/10 border border-neon-blue/30 text-neon-blue px-2 py-0.5 rounded hover:bg-neon-blue/20 transition-colors truncate max-w-[150px]"
                            >
                                {source.title}
                            </a>
                        ))}
                    </div>
                )}
                </>
            ) : (
                <p className="text-gray-600 text-xs font-mono uppercase">
                   Microphone Access Required for Voice Command
                </p>
            )}
        </div>

      </main>

      {/* Mobile-only status indicators (visible when HUD is hidden) */}
      <div className="md:hidden absolute top-4 left-4 right-4 flex justify-between text-[10px] text-gray-500 font-mono">
          <span>APEX AUTO v4.0</span>
          <span>BAT: {Math.floor(telemetry.battery)}%</span>
      </div>
    </div>
  );
};

export default App;