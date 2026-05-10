import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { cn } from '../lib/utils';

export const FastTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string, onChange: (e: any) => void }>(({ value, onChange, ...props }, ref) => {
  const [localValue, setLocalValue] = useState(value);
  const isComposing = useRef(false);

  useEffect(() => {
    if (!isComposing.current) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
    if (!isComposing.current) {
      onChange(e);
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (e: any) => {
    isComposing.current = false;
    onChange(e);
  };

  return (
    <textarea
      {...props}
      ref={ref}
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      className={cn("nowheel overflow-y-auto custom-scrollbar", props.className)}
    />
  );
});

export const FastInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { value: string, onChange: (e: any) => void }>(({ value, onChange, ...props }, ref) => {
  const [localValue, setLocalValue] = useState(value);
  const isComposing = useRef(false);

  useEffect(() => {
    if (!isComposing.current) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    if (!isComposing.current) {
      onChange(e);
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (e: any) => {
    isComposing.current = false;
    onChange(e);
  };

  return (
    <input
      {...props}
      ref={ref}
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  );
});
