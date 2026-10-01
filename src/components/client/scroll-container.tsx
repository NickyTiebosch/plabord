'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Een horizontaal scrollbaar vak dat bij het openen naar een beginpositie scrollt (bijvoorbeeld vandaag). */
export function ScrollContainer({
  children,
  initialScrollLeft,
  className,
}: {
  children: ReactNode;
  initialScrollLeft: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && initialScrollLeft > 0) ref.current.scrollLeft = initialScrollLeft;
  }, [initialScrollLeft]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
