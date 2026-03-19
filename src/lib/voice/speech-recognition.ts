/**
 * Web Speech API integration for voice querying.
 * Provides speech-to-text and text-to-speech capabilities.
 * Falls back gracefully when APIs are not supported.
 */

// Extend Window interface for webkit prefix
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  const win = window as unknown as Record<string, unknown>;
  const Constructor = (win['SpeechRecognition'] ??
    win['webkitSpeechRecognition']) as SpeechRecognitionConstructor | undefined;

  return Constructor ?? null;
}

/**
 * Check if Web Speech API (recognition) is supported in this browser.
 */
export function isSpeechSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/**
 * Check if Speech Synthesis (text-to-speech) is supported.
 */
export function isSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

export class SpeechNotSupportedError extends Error {
  constructor() {
    super('Speech recognition is not supported in this browser.');
    this.name = 'SpeechNotSupportedError';
  }
}

export class SpeechPermissionError extends Error {
  constructor() {
    super('Microphone permission was denied. Please allow microphone access to use voice input.');
    this.name = 'SpeechPermissionError';
  }
}

export class SpeechNoInputError extends Error {
  constructor() {
    super('No speech was detected. Please try again and speak clearly.');
    this.name = 'SpeechNoInputError';
  }
}

export class SpeechNetworkError extends Error {
  constructor() {
    super('A network error occurred during speech recognition. Please check your connection.');
    this.name = 'SpeechNetworkError';
  }
}

/**
 * Start listening for voice input using Web Speech API.
 * Returns the transcript when speech ends.
 * Falls back gracefully if API is not supported.
 *
 * @param lang - BCP 47 language tag (e.g., 'en-IN', 'hi-IN')
 * @returns Promise resolving to the recognized transcript text
 * @throws SpeechNotSupportedError if the API is unavailable
 * @throws SpeechPermissionError if microphone access was denied
 * @throws SpeechNoInputError if no speech was detected
 * @throws SpeechNetworkError if a network error occurs
 */
export function startListening(lang: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const Constructor = getSpeechRecognitionConstructor();

    if (!Constructor) {
      reject(new SpeechNotSupportedError());
      return;
    }

    const recognition = new Constructor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let hasResult = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      hasResult = true;
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      resolve(transcript.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      switch (event.error) {
        case 'not-allowed':
          reject(new SpeechPermissionError());
          break;
        case 'no-speech':
          reject(new SpeechNoInputError());
          break;
        case 'network':
          reject(new SpeechNetworkError());
          break;
        case 'aborted':
          reject(new Error('Speech recognition was aborted.'));
          break;
        default:
          reject(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      if (!hasResult) {
        reject(new SpeechNoInputError());
      }
    };

    try {
      recognition.start();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start speech recognition';
      reject(new Error(message));
    }
  });
}

/**
 * Stop any currently active speech recognition.
 * Safe to call even if nothing is active.
 */
let activeRecognition: SpeechRecognitionInstance | null = null;

export function startListeningWithHandle(lang: string): {
  promise: Promise<string>;
  stop: () => void;
} {
  const Constructor = getSpeechRecognitionConstructor();

  if (!Constructor) {
    return {
      promise: Promise.reject(new SpeechNotSupportedError()),
      stop: () => {},
    };
  }

  // Abort any previous active session to prevent concurrent recognition
  if (activeRecognition) {
    try { activeRecognition.abort(); } catch { /* ignore */ }
    activeRecognition = null;
  }

  const recognition = new Constructor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  activeRecognition = recognition;
  let hasResult = false;

  const promise = new Promise<string>((resolve, reject) => {
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      hasResult = true;
      activeRecognition = null;
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      resolve(transcript.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      activeRecognition = null;
      switch (event.error) {
        case 'not-allowed':
          reject(new SpeechPermissionError());
          break;
        case 'no-speech':
          reject(new SpeechNoInputError());
          break;
        case 'network':
          reject(new SpeechNetworkError());
          break;
        case 'aborted':
          reject(new Error('Speech recognition was aborted.'));
          break;
        default:
          reject(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      activeRecognition = null;
      if (!hasResult) {
        reject(new SpeechNoInputError());
      }
    };

    try {
      recognition.start();
    } catch (err: unknown) {
      activeRecognition = null;
      const message = err instanceof Error ? err.message : 'Failed to start speech recognition';
      reject(new Error(message));
    }
  });

  const stop = () => {
    try {
      recognition.stop();
    } catch {
      // Already stopped, ignore
    }
    activeRecognition = null;
  };

  return { promise, stop };
}

export function stopListening(): void {
  if (activeRecognition) {
    try {
      activeRecognition.abort();
    } catch {
      // Ignore errors when stopping
    }
    activeRecognition = null;
  }
}

/**
 * Speak text aloud using Web Speech Synthesis API.
 *
 * @param text - The text to speak
 * @param lang - BCP 47 language tag (e.g., 'en-IN', 'hi-IN')
 * @returns Promise that resolves when speech finishes
 */
export function speak(text: string, lang: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!isSynthesisSupported()) {
      // Resolve silently if synthesis is not supported — not critical
      resolve();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower for farmers
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (event) => {
      // 'interrupted' and 'canceled' are not real errors
      if (event.error === 'interrupted' || event.error === 'canceled') {
        resolve();
        return;
      }
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Stop any ongoing speech synthesis.
 */
export function stopSpeaking(): void {
  if (isSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
