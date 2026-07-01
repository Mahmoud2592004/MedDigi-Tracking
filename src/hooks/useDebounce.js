import { useState, useEffect, useRef } from 'react';

/**
 * Debounces a value by the specified delay (in ms).
 * Returns the debounced value which only updates after
 * the input has been stable for `delay` milliseconds.
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
