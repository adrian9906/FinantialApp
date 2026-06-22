'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type HexagonBackgroundProps = React.ComponentProps<'div'> & {
  hexagonProps?: React.ComponentProps<'div'>;
  hexagonSize?: number; // value greater than 50
  hexagonMargin?: number;
};

function HexagonBackground({
  className,
  children,
  hexagonProps,
  hexagonSize = 75,
  hexagonMargin = 3,
  ...props
}: HexagonBackgroundProps) {
  const hexagonWidth = hexagonSize;
  const hexagonHeight = hexagonSize * 1.1;
  const rowSpacing = hexagonSize * 0.8;
  const baseMarginTop = -36 - 0.275 * (hexagonSize - 100);
  const computedMarginTop = baseMarginTop + hexagonMargin;
  const oddRowMarginLeft = -(hexagonSize / 2);
  const evenRowMarginLeft = hexagonMargin / 2;
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [gridDimensions, setGridDimensions] = React.useState({
    rows: 0,
    columns: 0,
  });

  const updateGridDimensions = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const nextHeight = Math.max(container.scrollHeight, container.offsetHeight, window.innerHeight);
    const nextWidth = Math.max(container.scrollWidth, container.offsetWidth, window.innerWidth);
    const rows = Math.ceil(nextHeight / rowSpacing) + 1;
    const columns = Math.ceil(nextWidth / hexagonWidth) + 2;

    setGridDimensions((current) =>
      current.rows === rows && current.columns === columns
        ? current
        : { rows, columns },
    );
  }, [rowSpacing, hexagonWidth]);

  React.useEffect(() => {
    updateGridDimensions();
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      updateGridDimensions();
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', updateGridDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateGridDimensions);
    };
  }, [updateGridDimensions]);

  return (
    <div
      ref={containerRef}
      data-slot="hexagon-background"
      className={cn(
        'relative size-full min-h-full overflow-hidden dark:bg-neutral-900 bg-neutral-100',
        className,
      )}
      {...props}
    >
      <style>{`:root { --hexagon-margin: ${hexagonMargin}px; }`}</style>
      <div className="absolute top-0 -left-0 size-full overflow-hidden">
        {Array.from({ length: gridDimensions.rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            style={{
              marginTop: computedMarginTop,
              marginLeft:
                ((rowIndex + 1) % 2 === 0
                  ? evenRowMarginLeft
                  : oddRowMarginLeft) - 10,
            }}
            className="inline-flex"
          >
            {Array.from({ length: gridDimensions.columns }).map(
              (_, colIndex) => (
                <div
                  key={`hexagon-${rowIndex}-${colIndex}`}
                  {...hexagonProps}
                  style={{
                    width: hexagonWidth,
                    height: hexagonHeight,
                    marginLeft: hexagonMargin,
                    ...hexagonProps?.style,
                  }}
                  className={cn(
                    'relative',
                    '[clip-path:polygon(50%_0%,_100%_25%,_100%_75%,_50%_100%,_0%_75%,_0%_25%)]',
                    "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-full dark:before:bg-neutral-950 before:bg-white before:opacity-100 before:transition-all before:duration-1000",
                    "after:content-[''] after:absolute after:inset-[var(--hexagon-margin)] dark:after:bg-neutral-950 after:bg-white",
                    'after:[clip-path:polygon(50%_0%,_100%_25%,_100%_75%,_50%_100%,_0%_75%,_0%_25%)]',
                    'transition-transform duration-200 hover:scale-[1.03] hover:z-10 hover:before:bg-neutral-300 dark:hover:before:bg-violet-300/35 hover:before:opacity-100 hover:before:duration-0 dark:hover:after:bg-[color:var(--surface-container-high)] hover:after:bg-white/90 hover:after:opacity-100 hover:after:duration-0',
                    hexagonProps?.className,
                  )}
                />
              ),
            )}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

export { HexagonBackground, type HexagonBackgroundProps };
