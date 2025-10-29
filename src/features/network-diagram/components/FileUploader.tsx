/**
 * File Uploader Component
 * Centered drop zone for PKT/PKA file upload
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Plus, Lightbulb, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LoadingAnimation from '@/components/LoadingAnimation';
import { networkExamples } from '../lib/network-simulator/examples';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onStartEmpty: () => void;
  onStartWithExample: (exampleId: string) => void;
  isLoading?: boolean;
}

export default function FileUploader({
  onFileSelect,
  onStartEmpty,
  onStartWithExample,
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

  // Show loading animation when processing file
  if (isLoading) {
    return <LoadingAnimation fullScreen={false} />;
  }

  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <Card
          className={cn(
            'relative w-full p-12 border-2 border-dashed transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
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
          />
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Upload className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Upload Network Diagram
              </h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop your .pkt or .pka file here, or click to browse
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Supported formats:</span>
              <span className="font-mono bg-muted px-2 py-1 rounded">.pkt</span>
              <span className="font-mono bg-muted px-2 py-1 rounded">.pka</span>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-center">
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center justify-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Start with Example
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {networkExamples.map((example) => (
                <div key={example.id} className="relative group">
                  <Button
                    variant="outline"
                    onClick={() => onStartWithExample(example.id)}
                    disabled={!example.available}
                    className={cn(
                      'h-auto flex-col items-start text-left gap-1 p-4 w-full',
                      !example.available && 'opacity-50'
                    )}
                  >
                    <span className="font-medium">{example.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {example.available ? example.description : 'Coming soon'}
                    </span>
                  </Button>
                  {example.available && (
                    <Link
                      to={`/network-diagram/${example.id}`}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Open in new page"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 border-t border-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

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
      </div>
    </div>
  );
}
