'use client';

import { useCallback, useRef, useState } from 'react';

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface PhoneDropZoneProps {
  onFiles: (files: File[]) => void;
}

/**
 * Mobile-friendly file picker with tap-to-upload and drag support.
 * Supports multi-image selection for batch analysis on phone.
 */
export function PhoneDropZone({ onFiles }: PhoneDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter(
        (f) => ACCEPTED_TYPES.has(f.type) && f.size <= MAX_FILE_SIZE,
      );
      if (valid.length > 0) onFiles(valid);
    },
    [onFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles],
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(Array.from(e.target.files));
      e.target.value = '';
    },
    [processFiles],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        isDragging
          ? 'border-green-400 bg-green-50 dark:bg-green-950/20'
          : 'border-[var(--color-border)] bg-[var(--color-muted)]'
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40">
        <svg
          className="h-7 w-7 text-green-600 dark:text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
          />
        </svg>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Upload photos for batch scan
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Select multiple images at once
        </p>
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white active:bg-green-700"
      >
        Choose Photos
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleInput}
        className="hidden"
      />
    </div>
  );
}
