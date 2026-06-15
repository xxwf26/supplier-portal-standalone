import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface LimitedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function LimitedTextarea({
  value,
  onChange,
  maxLength = 500,
  placeholder,
  className,
  minHeight = 'min-h-[100px]',
}: LimitedTextareaProps) {
  const len = value.length;
  const countColor =
    len >= maxLength ? 'text-destructive font-medium' :
    len >= maxLength * 0.8 ? 'text-orange-500' :
    'text-muted-foreground';

  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        className={cn('resize-none', minHeight, className)}
      />
      <div className="flex justify-end mt-1">
        <span className={cn('text-[11px] tabular-nums', countColor)}>
          {len} / {maxLength}
        </span>
      </div>
    </div>
  );
}
