import React, { useRef } from 'react';
import { toast } from 'react-toastify';

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
  isProcessing?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, isProcessing = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (isProcessing) return;
    fileInputRef.current?.click();
  };

  const validateFile = (file: File): boolean => {
    if (!file) {
      toast.error('No file selected');
      return false;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(`Invalid file type. Allowed types: ${ALLOWED_TYPES.map(t => t.split('/')[1]).join(', ')}`);
      return false;
    }

    return true;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset input value to allow selecting the same file again
      event.target.value = '';

      if (!validateFile(file)) {
        return;
      }

      onImageUpload(file);
    } catch (error) {
      console.error('Error handling file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process image');
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleClick}
        type="button"
        className="flex items-center justify-center p-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundHover rounded-md transition-colors duration-200"
        title={isProcessing ? "Processing image..." : "Upload image (JPEG, PNG, GIF, WebP)"}
        aria-label={isProcessing ? "Processing image" : "Upload image"}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <div className="i-svg-spinners:90-ring-with-bg w-5 h-5 text-bolt-elements-loader-progress" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        aria-label="Upload image"
        disabled={isProcessing}
      />
    </div>
  );
};
