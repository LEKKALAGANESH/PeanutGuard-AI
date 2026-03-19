'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onError: (error: string) => void;
}

type CameraState = 'initializing' | 'ready' | 'denied' | 'error';

export default function CameraCapture({ onCapture, onError }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [errorMessage, setErrorMessage] = useState('');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState('initializing');
    setErrorMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState('ready');
    } catch (err) {
      const error = err as DOMException;

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraState('denied');
        setErrorMessage(
          'Camera access was denied. Please allow camera permissions in your browser settings to scan peanut crops.'
        );
      } else if (error.name === 'NotFoundError') {
        setCameraState('error');
        setErrorMessage(
          'No camera found on this device. You can still upload a photo from your gallery.'
        );
      } else {
        setCameraState('error');
        setErrorMessage(
          `Could not access camera: ${error.message}. Try uploading a photo instead.`
        );
      }

      onError(error.message);
    }
  }, [onError]);

  useEffect(() => {
    startCamera();

    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `peanut-scan-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          stopStream();
          onCapture(file);
        }
      },
      'image/jpeg',
      0.92
    );
  }, [onCapture, stopStream]);

  const handleGallerySelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        stopStream();
        onCapture(file);
      }
    },
    [onCapture, stopStream]
  );

  const openGallery = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (cameraState === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
          <svg
            className="h-10 w-10 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        <h2 className="mb-2 text-xl font-semibold text-white">Camera Access Needed</h2>
        <p className="mb-6 max-w-sm text-sm text-gray-400">{errorMessage}</p>

        <div className="mb-4 rounded-lg bg-gray-800 p-4 text-left text-sm text-gray-300">
          <p className="mb-2 font-medium text-white">How to enable camera:</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>Tap the lock/info icon in your browser address bar</li>
            <li>Find &quot;Camera&quot; permission</li>
            <li>Change it to &quot;Allow&quot;</li>
            <li>Refresh this page</li>
          </ol>
        </div>

        <div className="flex gap-3">
          <button
            onClick={startCamera}
            className="rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white active:bg-green-700"
          >
            Try Again
          </button>
          <button
            onClick={openGallery}
            className="rounded-xl bg-gray-700 px-6 py-3 text-sm font-semibold text-white active:bg-gray-600"
          >
            Upload Photo
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleGallerySelect}
          className="hidden"
        />
      </div>
    );
  }

  if (cameraState === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/20">
          <svg
            className="h-10 w-10 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        <h2 className="mb-2 text-xl font-semibold text-white">Camera Unavailable</h2>
        <p className="mb-6 max-w-sm text-sm text-gray-400">{errorMessage}</p>

        <button
          onClick={openGallery}
          className="min-h-[48px] min-w-[48px] rounded-xl bg-green-600 px-8 py-3 text-sm font-semibold text-white active:bg-green-700"
        >
          Upload from Gallery
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleGallerySelect}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black">
      {/* Camera Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleGallerySelect}
        className="hidden"
      />

      {/* Loading overlay */}
      {cameraState === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            <p className="text-sm text-gray-300">Starting camera...</p>
          </div>
        </div>
      )}

      {/* Scan frame guide */}
      {cameraState === 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-64 w-64 rounded-2xl border-2 border-white/40 sm:h-80 sm:w-80">
            <div className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-green-400" />
            <div className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-green-400" />
            <div className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-green-400" />
            <div className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-green-400" />
          </div>
        </div>
      )}

      {/* Top hint */}
      {cameraState === 'ready' && (
        <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 pb-12 pt-4">
          <p className="text-center text-sm font-medium text-white/90">
            Position peanut leaf within the frame
          </p>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-10 pt-8">
        <div className="flex items-center justify-center gap-8">
          {/* Gallery Button */}
          <button
            onClick={openGallery}
            className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-white/20 backdrop-blur-sm active:bg-white/30"
            aria-label="Select from gallery"
          >
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </button>

          {/* Capture Button */}
          <button
            onClick={handleCapture}
            disabled={cameraState !== 'ready'}
            className="flex h-[72px] w-[72px] min-h-[64px] min-w-[64px] items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur-sm active:bg-white/40 disabled:opacity-40"
            aria-label="Capture photo"
          >
            <div className="h-14 w-14 rounded-full bg-white" />
          </button>

          {/* Spacer to balance layout */}
          <div className="h-12 w-12" />
        </div>
      </div>
    </div>
  );
}
