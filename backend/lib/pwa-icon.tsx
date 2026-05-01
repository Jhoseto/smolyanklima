import type { ReactElement } from "react";

/**
 * Returns a JSX element used by next/og ImageResponse to generate PNG icons.
 * Flat colours are intentional — satori (the underlying renderer) does not
 * reliably resolve SVG linearGradient url() references.
 */
export function PwaIconJsx(size: number): ReactElement {
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;

  return (
    <div
      style={{
        width: size,
        height: size,
        background: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* viewBox matches Logo.tsx: "0 5 73 90" */}
      <svg
        viewBox="0 5 73 90"
        width={inner}
        height={inner}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Degree symbol — orange ring */}
        <circle cx="12" cy="12" r="5" stroke="#FF4D00" strokeWidth="3" fill="none" />

        {/* Top arc — orange */}
        <path
          d="M 70 15.4 A 40 40 0 0 0 10.1 47 L 28.2 47 A 22 22 0 0 1 61 30.9 Z"
          fill="#FF6A00"
        />

        {/* Bottom arc — blue */}
        <path
          d="M 10.1 53 A 40 40 0 0 0 70 84.6 L 61 69.1 A 22 22 0 0 1 28.2 53 Z"
          fill="#0099CC"
        />

        {/* Centre dot top half — orange */}
        <path d="M 62.6 47 A 13 13 0 0 0 37.4 47 Z" fill="#FF6A00" />

        {/* Centre dot bottom half — blue */}
        <path d="M 37.4 53 A 13 13 0 0 0 62.6 53 Z" fill="#0099CC" />
      </svg>
    </div>
  );
}
