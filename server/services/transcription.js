import OpenAI, { toFile } from 'openai';
import { v4 as uuidv4 } from 'uuid';

let openai = null;

function getClient() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Known Whisper hallucination phrases that appear on silent/near-silent audio
const HALLUCINATION_PATTERNS = [
  /^\.+$/,                          // Just dots/periods
  /^thank(s| you)/i,               // "Thanks for watching"
  /^you$/i,                        // Just "you"
  /^bye\.?$/i,                     // Just "bye"
  /thank you for watching/i,
  /thanks for watching/i,
  /please subscribe/i,
  /like and subscribe/i,
  /see you (next time|in the next)/i,
  /^(the|a|an)\.?$/i,              // Single articles
  /^\s*[.!?,;:]+\s*$/,            // Just punctuation
  /^music$/i,
  /^\[.*\]$/,                      // Just bracketed text like [Music]
  /subtitles by/i,
  /^(okay|ok)\.?$/i,
  /^(so|and|but|the|uh|um)\.?$/i, // Single filler/function words
  /^this is a voice command/i,    // Prompt echo
  /^thank you\.?\s*(bye|goodbye)?\.?$/i,
];

/**
 * Transcribe an audio buffer using OpenAI Whisper API.
 * @param {Buffer} audioBuffer - Raw audio data (WebM format from MediaRecorder)
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioBuffer) {
  if (!audioBuffer || audioBuffer.length === 0) {
    return '';
  }

  // Skip very small buffers — likely silence (WebM header alone is ~200-400 bytes,
  // but a 5s chunk with actual speech is typically >10KB)
  if (audioBuffer.length < 5000) {
    console.log(`Skipping tiny audio buffer: ${audioBuffer.length} bytes`);
    return '';
  }

  const client = getClient();

  const file = await toFile(audioBuffer, `recording-${uuidv4()}.webm`, {
    type: 'audio/webm',
  });

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
    language: 'en',
    temperature: 0,
  });

  const text = response.text || '';
  const trimmed = text.trim();

  // Filter out hallucinations
  if (!trimmed || trimmed.length < 2) {
    return '';
  }

  if (HALLUCINATION_PATTERNS.some((p) => p.test(trimmed))) {
    console.log(`Filtered hallucination: "${trimmed}"`);
    return '';
  }

  // Check Whisper's confidence via segments — if avg_logprob is very low,
  // the transcription is likely a hallucination
  if (response.segments && response.segments.length > 0) {
    const avgLogProb = response.segments.reduce((sum, s) => sum + (s.avg_logprob || 0), 0) / response.segments.length;
    const noSpeechProb = Math.max(...response.segments.map((s) => s.no_speech_prob || 0));

    console.log(`Whisper stats: avgLogProb=${avgLogProb.toFixed(3)}, noSpeechProb=${noSpeechProb.toFixed(3)}, text="${trimmed.substring(0, 60)}"`);

    // High no_speech_prob means the model thinks there's no speech
    if (noSpeechProb > 0.7) {
      console.log(`Filtered: high no_speech_prob (${noSpeechProb.toFixed(3)})`);
      return '';
    }

    // Very low avg_logprob means the model is uncertain — likely hallucination
    if (avgLogProb < -1.5) {
      console.log(`Filtered: low confidence (avgLogProb=${avgLogProb.toFixed(3)})`);
      return '';
    }
  }

  return trimmed;
}
