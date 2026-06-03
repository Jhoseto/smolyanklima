import React from 'react';
import { Link } from 'react-router-dom';

interface PrivacyCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  className?: string;
  /** Подсказка при опит за изпращане без съгласие */
  showError?: boolean;
}

export function PrivacyCheckbox({
  checked,
  onChange,
  id = 'privacy-consent',
  className = '',
  showError = false,
}: PrivacyCheckboxProps) {
  return (
    <label
      className={`flex items-start gap-3 cursor-pointer text-sm rounded-xl px-2 py-2 -mx-2 transition-colors ${
        showError
          ? 'animate-pulse bg-red-50 ring-2 ring-red-500 text-red-800'
          : 'text-gray-600'
      } ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={showError}
        className={`mt-0.5 w-4 h-4 rounded shrink-0 focus:ring-offset-0 ${
          showError
            ? 'border-red-500 text-red-600 focus:ring-red-500/40'
            : 'border-gray-300 text-[#FF4D00] focus:ring-[#FF4D00]/30'
        }`}
      />
      <span>
        Съгласен съм с{' '}
        <Link
          to="/politika-za-poveritelnost"
          className={`font-medium hover:underline ${showError ? 'text-red-700 underline' : 'text-[#00B4D8]'}`}
        >
          Политиката за поверителност
        </Link>
        .
        {showError && (
          <span className="mt-1 block text-xs font-semibold text-red-600">
            Моля, отбележете, за да изпратите запитването.
          </span>
        )}
      </span>
    </label>
  );
}
