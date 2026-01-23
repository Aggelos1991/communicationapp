import pako from 'pako';

// Max file size: 500KB after compression (to save DB storage)
export const MAX_COMPRESSED_SIZE = 500 * 1024; // 500KB
export const MAX_ORIGINAL_SIZE = 2 * 1024 * 1024; // 2MB original limit

/**
 * Compress a file and return base64 encoded compressed data
 */
export async function compressFile(file: File): Promise<{
  data: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
}> {
  // Check original size
  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_ORIGINAL_SIZE / 1024 / 1024}MB`);
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Compress using pako (gzip)
  const compressed = pako.gzip(uint8Array, { level: 9 });

  // Check compressed size
  if (compressed.length > MAX_COMPRESSED_SIZE) {
    throw new Error(`Compressed file too large (${Math.round(compressed.length / 1024)}KB). Maximum is ${MAX_COMPRESSED_SIZE / 1024}KB`);
  }

  // Convert to base64
  const base64 = btoa(String.fromCharCode(...compressed));

  return {
    data: base64,
    originalName: file.name,
    originalSize: file.size,
    compressedSize: compressed.length,
    mimeType: file.type || 'application/octet-stream'
  };
}

/**
 * Decompress base64 encoded gzip data and trigger download
 */
export function downloadCompressedFile(
  base64Data: string,
  fileName: string,
  mimeType: string
): void {
  // Handle missing or null data (legacy attachments)
  if (!base64Data || base64Data === 'null' || base64Data === 'undefined') {
    throw new Error('Attachment data is missing. This may be a legacy attachment that was not migrated.');
  }

  try {
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress
    const decompressed = pako.ungzip(bytes);

    // Create blob and download
    const blob = new Blob([decompressed], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error decompressing file:', error);
    throw new Error('Failed to download file. The attachment data may be corrupted or in an old format.');
  }
}

/**
 * Decompress and return as data URL for preview (images, PDFs)
 */
export function decompressToDataUrl(
  base64Data: string,
  mimeType: string
): string {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress
    const decompressed = pako.ungzip(bytes);

    // Convert to base64 for data URL
    const decompressedBase64 = btoa(String.fromCharCode(...decompressed));

    return `data:${mimeType};base64,${decompressedBase64}`;
  } catch (error) {
    console.error('Error decompressing for preview:', error);
    throw new Error('Failed to decompress file for preview');
  }
}

/**
 * Get file icon based on mime type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('text/')) return '📃';
  return '📎';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
