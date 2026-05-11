import type { ReactElement } from "react";

/**
 * Само „C“ формата от марката (без градус), координати като в Logo.
 * Bounding box на четирите path-а: x≈10.1…70, y≈15.4…84.6 → квадратен crop около (40, 50).
 */
const SYM_VBX = 4.5;
const SYM_VBY = 14.5;
const SYM_VBW = 71;
const SYM_VBH = 71;

/** JSX за next/og ImageResponse → PNG икони (админ PWA). Плоски цветове за satori. */
export function PwaIconJsx(size: number): ReactElement {
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
      <svg
        viewBox={`${SYM_VBX} ${SYM_VBY} ${SYM_VBW} ${SYM_VBH}`}
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 70 15.4 A 40 40 0 0 0 10.1 47 L 28.2 47 A 22 22 0 0 1 61 30.9 Z"
          fill="#FF6A00"
        />
        <path
          d="M 10.1 53 A 40 40 0 0 0 70 84.6 L 61 69.1 A 22 22 0 0 1 28.2 53 Z"
          fill="#0099CC"
        />
        <path d="M 62.6 47 A 13 13 0 0 0 37.4 47 Z" fill="#FF6A00" />
        <path d="M 37.4 53 A 13 13 0 0 0 62.6 53 Z" fill="#0099CC" />
      </svg>
    </div>
  );
}
