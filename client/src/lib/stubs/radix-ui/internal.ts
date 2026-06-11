// Stub for radix-ui/internal which is not publicly available
import { useState, useCallback, useRef, useEffect } from 'react';

interface UseControllableStateParams<T> {
  prop?: T;
  defaultProp?: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: UseControllableStateParams<T>): [T, (value: T) => void] {
  const isControlled = prop !== undefined;
  const [internalState, setInternalState] = useState<T>(defaultProp as T);
  const state = isControlled ? (prop as T) : internalState;

  const setState = useCallback(
    (value: T) => {
      if (!isControlled) {
        setInternalState(value);
      }
      onChange?.(value);
    },
    [isControlled, onChange],
  );

  return [state, setState];
}

export function useId() {
  const ref = useRef<string>();
  if (!ref.current) {
    ref.current = Math.random().toString(36).slice(2);
  }
  return ref.current;
}