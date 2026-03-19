"use client";

import { useState, useRef, useCallback } from 'react';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  error: string | null;
  facingMode: 'environment' | 'user';
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  captureFrame: () => File | null;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);

    // Check for mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API is not supported in this browser.');
      return;
    }

    // Stop any existing stream before starting a new one
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);
    } catch (err: unknown) {
      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setError(
              'Camera permission denied. Please allow camera access in your browser settings.'
            );
            break;
          case 'NotFoundError':
            setError('No camera found on this device.');
            break;
          case 'NotReadableError':
            setError(
              'Camera is already in use by another application.'
            );
            break;
          case 'OverconstrainedError':
            setError(
              'Camera does not meet the required constraints. Trying with default settings may help.'
            );
            break;
          default:
            setError(`Camera error: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred while accessing the camera.');
      }
    }
  }, [stopCamera, facingMode]);

  const switchCamera = useCallback(async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isStreaming) {
      stopCamera();
      // startCamera will re-run with the new facingMode after state update
      setTimeout(() => startCamera(), 100);
    }
  }, [facingMode, isStreaming, stopCamera, startCamera]);

  const captureFrame = useCallback((): File | null => {
    if (!videoRef.current || !isStreaming) {
      return null;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob synchronously via toDataURL, then to File
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const timestamp = Date.now();
    return new File([blob], `capture-${timestamp}.jpg`, {
      type: 'image/jpeg',
    });
  }, [isStreaming]);

  return {
    videoRef,
    isStreaming,
    error,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame,
  };
}
