import React, { useState, useRef, useCallback } from 'react';
// Fix: Add Blob to imports
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import type { TranscriptionTurn } from './types';
import { decode, encode, decodeAudioData } from './utils/audio';
import { MicrophoneButton } from './components/MicrophoneButton';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { StatusIndicator } from './components/StatusIndicator';

const App: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionTurn[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<LiveSession | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  
  // Fix: Add refs to prevent stale closures in callbacks for streaming data and state.
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const cleanupAudio = useCallback(() => {
    // Stop all playing audio
    outputSourcesRef.current.forEach(source => source.stop());
    outputSourcesRef.current.clear();

    // Disconnect microphone processing
    scriptProcessorRef.current?.disconnect();
    mediaStreamSourceRef.current?.disconnect();
    
    // Close audio contexts
    if (inputAudioContextRef.current?.state !== 'closed') {
      inputAudioContextRef.current?.close().catch(console.error);
    }
    if (outputAudioContextRef.current?.state !== 'closed') {
      outputAudioContextRef.current?.close().catch(console.error);
    }

    // Clear refs
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current = null;
    nextStartTimeRef.current = 0;
  }, []);

  const stopSession = useCallback(async () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    cleanupAudio();
    setIsSessionActive(false);
    setIsConnecting(false);
  }, [cleanupAudio]);

  const handleToggleSession = useCallback(async () => {
    if (isSessionActive) {
      await stopSession();
      return;
    }

    setIsConnecting(true);
    setError(null);
    setTranscriptionHistory([]);
    setCurrentInput('');
    setCurrentOutput('');
    // Fix: Reset refs for new session
    currentInputRef.current = '';
    currentOutputRef.current = '';
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      // Fix: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for broader browser compatibility.
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // Fix: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for broader browser compatibility.
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are Aetheria, a friendly and helpful personal assistant. Your goal is to provide accurate information, engage in pleasant conversation, and assist the user with their queries in a warm and supportive manner.',
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsSessionActive(true);
            mediaStreamSourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(stream);
            scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              // Fix: Use ref to avoid stale closure on isMuted state
              if (isMutedRef.current) return;
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              // Fix: Use a more performant loop instead of .map for audio processing and create a Blob object.
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Fix: Handle transcriptions using refs to build up the full text and avoid stale state in turnComplete
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInputRef.current += text;
              setCurrentInput(prev => prev + text);
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutputRef.current += text;
              setCurrentOutput(prev => prev + text);
            }
            if (message.serverContent?.turnComplete) {
                const fullInput = currentInputRef.current;
                const fullOutput = currentOutputRef.current;

                if (fullInput || fullOutput) {
                  setTranscriptionHistory(prev => [
                      ...prev,
                      { speaker: 'You', text: fullInput },
                      { speaker: 'Aetheria', text: fullOutput }
                  ]);
                }

                setCurrentInput('');
                setCurrentOutput('');
                currentInputRef.current = '';
                currentOutputRef.current = '';
            }
            if (message.serverContent?.interrupted) {
                outputSourcesRef.current.forEach(source => source.stop());
                outputSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const audioContext = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
              const audioBuffer = await decodeAudioData(decode(audioData), audioContext, 24000, 1);
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              source.addEventListener('ended', () => outputSourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              outputSourcesRef.current.add(source);
            }
          },
          onclose: () => {
            stream.getTracks().forEach(track => track.stop());
            stopSession();
          },
          onerror: (e: any) => {
            setError(`An error occurred: ${e.message || 'Unknown error'}`);
            stream.getTracks().forEach(track => track.stop());
            stopSession();
          },
        },
      });
      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      setError(`Failed to start session: ${err.message}`);
      setIsConnecting(false);
    }
    // Fix: Remove stale dependencies from useCallback
  }, [isSessionActive, stopSession]);

  const toggleMute = () => setIsMuted(prev => !prev);
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans">
      <header className="text-center p-4 md:p-6 border-b border-gray-700">
        <h1 className="text-3xl md:text-4xl font-bold tracking-wider text-cyan-300">Aetheria</h1>
        <p className="text-gray-400 mt-1">Your Personal AI Assistant</p>
      </header>

      <main className="flex-grow flex flex-col p-4 overflow-y-auto">
        <div className="flex-grow w-full max-w-4xl mx-auto">
            {!isSessionActive && !isConnecting && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-24 h-24 mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-cyan-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">Hello! I'm Aetheria.</h2>
                    <p className="text-gray-400 max-w-md">I'm your personal AI assistant. Press the microphone button to start our conversation. You can ask me anything!</p>
                </div>
            )}
            <TranscriptionDisplay 
                history={transcriptionHistory}
                currentInput={currentInput}
                currentOutput={currentOutput}
            />
        </div>
        {error && <div className="text-center text-red-400 p-2">{error}</div>}
      </main>

      <footer className="sticky bottom-0 left-0 right-0 p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center">
          <StatusIndicator isActive={isSessionActive} isConnecting={isConnecting} />
          <div className="flex items-center space-x-6 mt-4">
             <button 
                onClick={toggleMute}
                disabled={!isSessionActive}
                className={`p-3 rounded-full transition-colors duration-200 ${isSessionActive ? 'text-white bg-gray-700 hover:bg-gray-600' : 'text-gray-600 bg-gray-800 cursor-not-allowed'}`}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                  {isMuted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm-1 4a4 4 0 108 0V4a4 4 0 10-8 0v4zM3 9a.75.75 0 00-.75.75v.5c0 3.53 2.61 6.437 6 6.92V18H6.75a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5H11v-1.83c3.39-.483 6-3.39 6-6.92v-.5A.75.75 0 0016.25 9H15a.75.75 0 000 1.5h.25a6.5 6.5 0 01-13 0H2.25a.75.75 0 000-1.5H3zM4.132 11.385a5.002 5.002 0 008.736 0H4.132z" clipRule="evenodd" />
                      </svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
                          <path d="M2.221 10.33a.75.75 0 011.06 0l1.36 1.359a.75.75 0 01-1.06 1.061l-1.36-1.36a.75.75 0 010-1.06zM16.458 11.39a.75.75 0 011.06-1.06l1.36 1.36a.75.75 0 01-1.06 1.06l-1.36-1.36z" />
                      </svg>
                  )}
              </button>
            <MicrophoneButton 
              isActive={isSessionActive} 
              isConnecting={isConnecting} 
              onClick={handleToggleSession} 
            />
            <div className="w-12 h-12"></div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;