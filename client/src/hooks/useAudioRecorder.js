import { useState, useRef, useCallback, useEffect } from 'react';

const CHUNK_INTERVAL = 5000; // 5 seconds

export function useAudioRecorder(onAudioChunk) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const recorderRef = useRef(null);
  const isRecordingRef = useRef(false);
  const peakLevelRef = useRef(0); // Track peak audio level during each chunk
  const onAudioChunkRef = useRef(onAudioChunk);
  onAudioChunkRef.current = onAudioChunk;

  // Minimum peak audio level (0-1) required to send a chunk.
  // Below this, the chunk is considered silence and skipped.
  const SILENCE_THRESHOLD = 0.03;

  // Create a fresh recorder on the existing stream and record for one interval,
  // then deliver the complete blob and restart.
  const recordOneChunk = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !isRecordingRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    // Reset peak level for this chunk
    peakLevelRef.current = 0;

    recorder.onstop = () => {
      const hadSpeech = peakLevelRef.current > SILENCE_THRESHOLD;
      if (chunks.length > 0 && hadSpeech) {
        const blob = new Blob(chunks, { type: mimeType });
        blob.arrayBuffer().then((buffer) => {
          onAudioChunkRef.current?.(buffer);
        });
      } else if (!hadSpeech) {
        console.log(`Skipped silent chunk (peak level: ${peakLevelRef.current.toFixed(4)})`);
      }
      // Schedule next chunk if still recording
      if (isRecordingRef.current) {
        recordOneChunk();
      }
    };

    recorder.start();

    // Stop after the interval to produce a complete file
    chunkTimerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, CHUNK_INTERVAL);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Set up audio analyser for level meter
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start level monitoring — also track peak level per chunk for silence detection
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const level = avg / 255;
        setAudioLevel(level);
        // Track the peak level seen during the current chunk
        if (level > peakLevelRef.current) {
          peakLevelRef.current = level;
        }
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      isRecordingRef.current = true;
      setIsRecording(true);
      setDuration(0);

      // Start the stop/restart chunking cycle
      recordOneChunk();

      // Duration timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      throw err;
    }
  }, [recordOneChunk]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;

    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop(); // This triggers onstop which sends the final chunk
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      stopRecording();
    };
  }, [stopRecording]);

  return { isRecording, duration, audioLevel, startRecording, stopRecording };
}
