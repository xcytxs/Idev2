import { useEffect, useRef } from 'react';
import { IconButton } from '../ui/IconButton';

interface VoiceRecordModalProps {
  isRecording: boolean;
  onStop: () => void;
  onCancel: () => void;
}

export function VoiceRecordModal({ isRecording, onStop, onCancel }: VoiceRecordModalProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRecording) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          audioContextRef.current = new AudioContext();
          analyserRef.current = audioContextRef.current.createAnalyser();
          const source = audioContextRef.current.createMediaStreamSource(stream);
          source.connect(analyserRef.current);
          
          analyserRef.current.minDecibels = -85;
          analyserRef.current.maxDecibels = -10;
          analyserRef.current.smoothingTimeConstant = 0.7;
          
          const updateGlow = () => {
            if (!analyserRef.current || !glowRef.current || glowRef.current.matches(':hover')) return;
            
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            
            const weightedSum = dataArray.slice(0, 100).reduce((acc, val, idx) => {
              const weight = 1 - (idx / 200);
              return acc + (val * weight);
            }, 0);
            
            const average = weightedSum / 100;
            const intensity = Math.min((average / 100) * 1.5, 1);
            
            glowRef.current.style.boxShadow = `0 0 ${20 + intensity * 35}px ${8 + intensity * 20}px rgb(59 130 246 / ${0.4 + intensity * 0.5})`;
          };

          const animation = setInterval(updateGlow, 50);
          return () => clearInterval(animation);
        });
    }
  }, [isRecording]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="flex flex-col items-center bg-bolt-background-secondary/60 p-12 rounded-2xl backdrop-blur-xl border border-white/10">
        <IconButton
          icon="i-ph:x"
          onClick={onCancel}
          className="absolute top-3 right-3 hover:text-bolt-elements-icon-error transition-colors"
          title="Cancel recording"
        />
        
        <div 
          ref={glowRef}
          className="w-32 h-32 rounded-full bg-bolt-background-primary/80 flex items-center justify-center cursor-pointer 
            transition-all duration-300 
            hover:bg-red-900/30
            [&:hover]:shadow-[0_0_30px_12px_rgba(220,38,38,0.25)]
            group
            relative"
          onClick={onStop}
        >
          <div className="i-bolt:microphone text-4xl text-bolt-foreground-primary transition-colors group-hover:text-red-500" />
        </div>
        
        <p className="text-center mt-8 text-white/70 font-medium">
          {isRecording ? 'Click to stop recording' : 'Starting...'}
        </p>
      </div>
    </div>
  );
} 