import React from 'react';
import { Link } from 'react-router-dom';

interface PrivacyCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}

export function PrivacyCheckbox({
  checked,
  onChange,
  id = 'privacy-consent',
  className = '',
}: PrivacyCheckboxProps) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer text-sm text-gray-600 ${className}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#FF4D00] focus:ring-[#FF4D00]/30 shrink-0"
      />
      <span>
        Съгласен съм с{' '}
        <Link to="/politika-za-poveritelnost" className="text-[#00B4D8] hover:underline font-medium">
          Политиката за поверителност
        </Link>
        .
      </span>
    </label>
  );
}
