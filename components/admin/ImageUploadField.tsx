'use client';

import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';

interface ImageUploadFieldProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
}

export default function ImageUploadField({
  label = 'Cover Image (Upload or URL)',
  value,
  onChange,
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        setError(data.error || 'Image upload failed.');
      } else {
        onChange(data.url);
      }
    } catch {
      setError('Failed to upload image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-300">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://... or upload an image file"
          className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-60 cursor-pointer"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          <span>{uploading ? 'Uploading...' : 'Upload'}</span>
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Clear image"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-2.5 py-2 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}

      {value ? (
        <div className="mt-2.5 overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-1.5">
          <img src={value} alt="Preview" className="h-28 w-full rounded-lg object-cover" />
        </div>
      ) : null}
    </div>
  );
}
