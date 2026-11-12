import { useEffect, useRef, useState } from 'react';

export function useElementSize() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = (nextWidth) => {
      const rounded = Math.max(0, Math.floor(nextWidth));
      setWidth((previous) => (Math.abs(previous - rounded) > 1 ? rounded : previous));
    };

    update(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => update(element.clientWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
