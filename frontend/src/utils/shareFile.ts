import toast from 'react-hot-toast';

export const sanitizeFileNamePart = (value: string | number | null | undefined, fallback = 'file'): string => {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64 = ''] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

export const downloadBlobFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

interface ShareOrDownloadOptions {
  blob: Blob;
  fileName: string;
  title: string;
  text?: string;
}

/**
 * Uses the native Web Share sheet for files when supported and falls back
 * cleanly to downloading the file with a toast notification on failure.
 */
export const shareOrDownloadFile = async ({
  blob,
  fileName,
  title,
  text,
}: ShareOrDownloadOptions): Promise<'shared' | 'downloaded' | 'aborted'> => {
  const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;

    if (canShareFiles) {
      try {
        await navigator.share({
          files: [file],
          title,
          ...(text ? { text } : {}),
        });
        return 'shared';
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return 'aborted';
        }
        console.warn('Native share unavailable or failed, downloading instead:', err);
        downloadBlobFile(blob, fileName);
        toast.success(`${fileName} downloaded (native share unavailable)`);
        return 'downloaded';
      }
    }
  }

  downloadBlobFile(blob, fileName);
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    toast.success(`${fileName} downloaded (native share requires HTTPS or localhost)`);
  } else {
    toast.success(`${fileName} downloaded`);
  }
  return 'downloaded';
};

