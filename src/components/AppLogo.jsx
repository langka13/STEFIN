import React from 'react';

export function AppLogo({ className = "w-16 h-16" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="24" className="fill-[#ffffff] dark:fill-[#1a1a1a] shadow-sm border border-slate-100 dark:border-slate-800" />
      
      {/* Wallet / Ledger Body */}
      <rect x="28" y="38" width="44" height="36" rx="10" className="fill-[#222222] dark:fill-[#eeeeee]" opacity="0.95" />
      
      {/* Coin / Growth Indicator overlapping */}
      <circle cx="62" cy="38" r="18" fill="#89E900" opacity="0.95" />
      
      {/* Accent inside wallet */}
      <rect x="36" y="56" width="20" height="6" rx="3" className="fill-[#ffffff] dark:fill-[#222222]" opacity="0.5" />
    </svg>
  );
}
