'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBulkScanStore } from '@/stores/bulk-scan-store';

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
]);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function BulkDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = useBulkScanStore((s) => s.addFiles);

  const processFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter(
        (f) => ACCEPTED_TYPES.has(f.type) && f.size <= MAX_FILE_SIZE,
      );
      if (valid.length > 0) {
        addFiles(valid);
      }
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const items = Array.from(e.dataTransfer.items);
      const files: File[] = [];

      // Support folder drops via webkitGetAsEntry
      const entries: FileSystemEntry[] = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          entries.push(entry);
        }
      }

      if (entries.length > 0) {
        for (const entry of entries) {
          if (entry.isFile) {
            const file = await entryToFile(entry as FileSystemFileEntry);
            if (file) files.push(file);
          } else if (entry.isDirectory) {
            const dirFiles = await readDirectory(
              entry as FileSystemDirectoryEntry,
            );
            files.push(...dirFiles);
          }
        }
      } else {
        // Fallback for browsers without webkitGetAsEntry
        files.push(...Array.from(e.dataTransfer.files));
      }

      processFiles(files);
    },
    [processFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set false if leaving the container, not a child
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(Array.from(e.target.files));
      }
      // Reset so the same folder can be re-selected
      e.target.value = '';
    },
    [processFiles],
  );

  return (
    <motion.div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      animate={{
        scale: isDragging ? 1.02 : 1,
        borderColor: isDragging
          ? 'rgba(34, 197, 94, 0.6)'
          : 'rgba(148, 163, 184, 0.2)',
      }}
      transition={{ duration: 0.2 }}
      className="glass-card flex flex-1 flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed p-12 transition-colors"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isDragging ? 'drop' : 'idle'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800/80 text-4xl">
            {isDragging ? (
              <svg
                className="h-10 w-10 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            ) : (
              <svg
                className="h-10 w-10 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            )}
          </div>

          {isDragging ? (
            <p className="text-lg font-medium text-green-400">
              Drop images here
            </p>
          ) : (
            <>
              <p className="text-lg font-medium text-slate-300">
                Drag & drop images or folders
              </p>
              <p className="text-sm text-slate-500">
                JPEG, PNG, WebP &middot; Up to 20MB per file &middot;
                Unlimited images
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {!isDragging && (
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-slate-700/80 px-6 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
        >
          Browse Files
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

function entryToFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (f) => resolve(f),
      () => resolve(null),
    );
  });
}

async function readDirectory(
  entry: FileSystemDirectoryEntry,
): Promise<File[]> {
  const reader = entry.createReader();
  const files: File[] = [];

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(
        (entries) => resolve(entries),
        (err) => reject(err),
      );
    });

  // readEntries may return partial results; loop until empty
  let batch = await readBatch();
  while (batch.length > 0) {
    for (const e of batch) {
      if (e.isFile) {
        const file = await entryToFile(e as FileSystemFileEntry);
        if (file && ACCEPTED_TYPES.has(file.type)) {
          files.push(file);
        }
      } else if (e.isDirectory) {
        const subFiles = await readDirectory(e as FileSystemDirectoryEntry);
        files.push(...subFiles);
      }
    }
    batch = await readBatch();
  }

  return files;
}
