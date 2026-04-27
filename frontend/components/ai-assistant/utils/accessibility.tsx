/**
 * Accessibility Utilities
 * WCAG 2.1 AA Compliance helpers
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Announces messages to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.style.cssText = `
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Focus trap for modals and chat windows
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Keyboard navigation hook
 */
export function useKeyboardNavigation(handlers: {
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onTab?: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handlers.onEscape?.();
          break;
        case 'Enter':
          if (!e.shiftKey) {
            e.preventDefault();
            handlers.onEnter?.();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          handlers.onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handlers.onArrowDown?.();
          break;
        case 'Tab':
          handlers.onTab?.();
          break;
      }
    },
    [handlers]
  );

  return handleKeyDown;
}

/**
 * Generate ARIA attributes for chat messages
 */
export function getMessageAriaProps(role: 'user' | 'assistant', index: number, total: number) {
  return {
    role: 'listitem',
    'aria-posinset': index + 1,
    'aria-setsize': total,
    'aria-label': role === 'user' ? 'Ваше съобщение' : 'Отговор от асистента',
  };
}

/**
 * High contrast mode detection
 */
export function useHighContrastMode(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isHighContrast;
}

/**
 * Reduced motion preference
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Color contrast checker
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 */
export function checkContrastRatio(foreground: string, background: string): number {
  const getLuminance = (color: string): number => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const adjust = (c: number) => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Skip link for keyboard navigation
 */
export function SkipLink({ targetId, label }: { targetId: string; label: string }) {
  const handleClick = () => {
    const target = document.getElementById(targetId);
    target?.focus();
    target?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: -40,
        left: 0,
        background: '#000',
        color: '#fff',
        padding: '8px 16px',
        zIndex: 10000,
        textDecoration: 'none',
        transition: 'top 0.2s',
      }}
      onFocus={(e) => (e.currentTarget.style.top = '0')}
      onBlur={(e) => (e.currentTarget.style.top = '-40px')}
    >
      {label}
    </a>
  );
}

/**
 * ARIA labels for chat widget
 */
export const chatWidgetAriaLabels = {
  openButton: 'Отвори чат с асистент',
  closeButton: 'Затвори чат',
  input: 'Напишете съобщение',
  sendButton: 'Изпрати съобщение',
  voiceButton: 'Гласово въвеждане',
  messagesList: 'Списък със съобщения',
  typingIndicator: 'Асистентът пише отговор',
  quickReplies: 'Бързи опции',
  productsList: 'Препоръчани продукти',
};

/**
 * Font size adjustment utility
 */
export function useFontSizeAdjustment() {
  const [fontSize, setFontSize] = useState(16);

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.min(prev + 2, 24));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.max(prev - 2, 12));
  }, []);

  const resetFontSize = useCallback(() => {
    setFontSize(16);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  return { fontSize, increaseFontSize, decreaseFontSize, resetFontSize };
}

/**
 * Accessibility announcement component
 */
export function AccessibilityAnnouncer({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: -10000,
        width: 1,
        height: 1,
        overflow: 'hidden',
      }}
    >
      {message}
    </div>
  );
}

