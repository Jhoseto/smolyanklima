import React, { useState, useEffect, useRef } from 'react';

interface ScrambleTextProps {
  text: string;
  className?: string;
  scrambleSpeed?: number;
  scrambleChars?: string;
}

export const ScrambleText = ({
  text,
  className = '',
  scrambleSpeed = 40,
  scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+1234567890',
}: ScrambleTextProps) => {
  const [displayText, setDisplayText] = useState(text);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHovered) {
      setDisplayText(text);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      return;
    }

    let iteration = 0;
    intervalRef.current = window.setInterval(() => {
      setDisplayText((prev) =>
        prev
          .split('')
          .map((letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            // Preserve spaces
            if (text[index] === ' ') return ' ';
            
            return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
        }
      }

      iteration += 1 / 3;
    }, scrambleSpeed);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isHovered, text, scrambleSpeed, scrambleChars]);

  return (
    <span
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {displayText}
    </span>
  );
};
