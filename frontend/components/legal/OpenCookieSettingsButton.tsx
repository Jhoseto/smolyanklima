import React from 'react';

export function OpenCookieSettingsButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="text-[#00B4D8] hover:underline font-medium bg-transparent border-0 p-0 cursor-pointer inline"
      onClick={() => window.dispatchEvent(new Event('sk-open-cookie-settings'))}
    >
      {children}
    </button>
  );
}
