import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useVoiceRecorder');

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setAudioChunks(chunks => [...chunks, e.data]);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      logger.error('Failed to start recording:', error);
      toast.error('Microphone permission denied. Please allow microphone access to use voice recording.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  const getRecordingBlob = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
      setAudioChunks([]);
      resolve(audioBlob);
    });
  }, [audioChunks]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    getRecordingBlob
  };
} 