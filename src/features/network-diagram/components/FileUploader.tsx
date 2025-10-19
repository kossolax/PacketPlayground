/**
 * File Uploader Component
 * Centered drop zone for PKT/PKA file upload
 */

import { useCallback, useState } from 'react';
import { Upload, FileArchive, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onStartEmpty: () => void;
  isLoading?: boolean;
}

export default function FileUploader({
  onFileSelect,
  onStartEmpty,
  isLoading = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file && (file.name.endsWith('.pkt') || file.name.endsWith('.pka'))) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    []
  );

  const handleDragEnter = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <Card
          className={cn(
            'relative w-full p-12 border-2 border-dashed transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            isLoading && 'opacity-50 pointer-events-none'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".pkt,.pka"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isLoading}
          />
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            {isLoading ? (
              <>
                <FileArchive className="h-16 w-16 text-primary animate-pulse" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">
                    Decoding network topology...
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we process your file
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-16 w-16 text-muted-foreground" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">
                    Upload Network Diagram
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop your .pkt or .pka file here, or click to
                    browse
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Supported formats:</span>
                  <span className="font-mono bg-muted px-2 py-1 rounded">
                    .pkt
                  </span>
                  <span className="font-mono bg-muted px-2 py-1 rounded">
                    .pka
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>

        {!isLoading && (
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border" />
          </div>
        )}

        {!isLoading && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={onStartEmpty}
              className="gap-2"
            >
              <Plus className="h-5 w-5" />
              Start with Empty Diagram
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
