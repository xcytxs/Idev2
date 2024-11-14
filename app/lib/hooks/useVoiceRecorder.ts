import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = 'audio/wav';
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          setAudioChunks((chunks: Blob[]) => [...chunks, e.data]);
        }
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      toast.error('Microphone permission denied. Please allow microphone access to use voice recording.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.requestData();
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  const getRecordingBlob = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      if (audioChunks.length === 0) {
        return resolve(new Blob([], { type: 'audio/wav' }));
      }

      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
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