'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { QueryAction } from '@/lib/voice/query-matcher';
import { matchVoiceQuery, getActionLabel, getAllActions } from '@/lib/voice/query-matcher';
import {
  isSpeechSupported,
  startListening,
  stopListening,
  stopSpeaking,
  SpeechNotSupportedError,
  SpeechPermissionError,
  SpeechNoInputError,
} from '@/lib/voice/speech-recognition';

interface VoiceQueryButtonProps {
  onAction: (action: QueryAction) => void;
  locale: string;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'unsupported';

export default function VoiceQueryButton({ onAction, locale }: VoiceQueryButtonProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showFallback, setShowFallback] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!isSpeechSupported()) {
      setVoiceState('unsupported');
      setShowFallback(true);
    }

    return () => {
      mountedRef.current = false;
      stopListening();
      stopSpeaking();
    };
  }, []);

  const handleVoiceClick = useCallback(async () => {
    if (voiceState === 'listening' || voiceState === 'processing' || voiceState === 'speaking') {
      stopListening();
      stopSpeaking();
      setVoiceState('idle');
      return;
    }

    setErrorMessage('');
    setVoiceState('listening');

    try {
      const transcript = await startListening(locale);

      if (!mountedRef.current) return;
      setVoiceState('processing');

      const match = matchVoiceQuery(transcript);

      if (!mountedRef.current) return;

      if (match.confidence > 0) {
        onAction(match.action);
      } else {
        // If no match, show fallback questions
        setShowFallback(true);
      }

      setVoiceState('idle');
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      if (err instanceof SpeechNotSupportedError) {
        setVoiceState('unsupported');
        setShowFallback(true);
      } else if (err instanceof SpeechPermissionError) {
        setErrorMessage('Microphone permission denied. Please allow access in your browser settings.');
        setVoiceState('idle');
      } else if (err instanceof SpeechNoInputError) {
        setErrorMessage('No speech detected. Tap and speak clearly.');
        setVoiceState('idle');
      } else {
        const message = err instanceof Error ? err.message : 'Voice input failed';
        setErrorMessage(message);
        setVoiceState('idle');
      }
    }
  }, [voiceState, locale, onAction]);

  const handleFallbackAction = useCallback(
    (action: QueryAction) => {
      onAction(action);
      setShowFallback(false);
    },
    [onAction]
  );

  const isHindi = locale.startsWith('hi');

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main voice button */}
      {voiceState !== 'unsupported' && (
        <button
          type="button"
          onClick={handleVoiceClick}
          role="button"
          aria-label={
            voiceState === 'listening'
              ? 'Listening... tap to stop'
              : voiceState === 'processing'
                ? 'Processing your question...'
                : voiceState === 'speaking'
                  ? 'Speaking... tap to stop'
                  : isHindi
                    ? 'Apna sawal poochein'
                    : 'Ask a question'
          }
          className={`
            relative flex items-center justify-center
            w-14 h-14 rounded-full
            transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${voiceState === 'idle' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500 shadow-lg hover:shadow-xl' : ''}
            ${voiceState === 'listening' ? 'bg-red-500 focus:ring-red-400 shadow-lg' : ''}
            ${voiceState === 'processing' ? 'bg-yellow-500 focus:ring-yellow-400' : ''}
            ${voiceState === 'speaking' ? 'bg-blue-500 focus:ring-blue-400' : ''}
          `}
        >
          {/* Pulsing ring animation when listening */}
          {voiceState === 'listening' && (
            <span
              className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40"
              aria-hidden="true"
            />
          )}

          {/* Icon */}
          <span className="relative z-10">
            {voiceState === 'idle' && <MicrophoneIcon />}
            {voiceState === 'listening' && <MicrophoneActiveIcon />}
            {voiceState === 'processing' && <ProcessingIcon />}
            {voiceState === 'speaking' && <SpeakerIcon />}
          </span>
        </button>
      )}

      {/* State label */}
      {voiceState === 'listening' && (
        <p className="text-sm text-red-600 font-medium animate-pulse">
          {isHindi ? 'Sun raha hai... boliye' : 'Listening... speak now'}
        </p>
      )}
      {voiceState === 'processing' && (
        <p className="text-sm text-yellow-600 font-medium">
          {isHindi ? 'Samajh raha hai...' : 'Processing...'}
        </p>
      )}

      {/* Error message */}
      {errorMessage && (
        <p className="text-xs text-red-600 text-center max-w-[250px]" role="alert">
          {errorMessage}
        </p>
      )}

      {/* Fallback: common question buttons */}
      {showFallback && (
        <div className="w-full max-w-sm mt-2">
          <p className="text-xs text-gray-500 text-center mb-2">
            {voiceState === 'unsupported'
              ? isHindi
                ? 'Voice support nahi hai. Neeche se chunein:'
                : 'Voice not supported. Choose a question:'
              : isHindi
                ? 'Ya phir neeche se chunein:'
                : 'Or choose a question:'}
          </p>
          <div className="flex flex-col gap-2">
            {getAllActions().map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => handleFallbackAction(action)}
                className="
                  w-full text-left px-4 py-2.5 rounded-lg
                  bg-white border border-gray-200
                  text-sm text-gray-800
                  hover:bg-green-50 hover:border-green-300
                  active:bg-green-100
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-green-400
                "
              >
                {getActionLabel(action, locale)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle fallback visibility */}
      {voiceState !== 'unsupported' && (
        <button
          type="button"
          onClick={() => setShowFallback((prev) => !prev)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
          aria-label={showFallback ? 'Hide common questions' : 'Show common questions'}
        >
          {showFallback
            ? isHindi
              ? 'Sawal chupaao'
              : 'Hide questions'
            : isHindi
              ? 'Sawal dikhaao'
              : 'Show questions'}
        </button>
      )}
    </div>
  );
}

// ── SVG Icons ──

function MicrophoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function MicrophoneActiveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="white"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function ProcessingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
