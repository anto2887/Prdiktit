import React from 'react';
import { FaSnowflake } from 'react-icons/fa';
import { GiShield, GiTwoCoins } from 'react-icons/gi';
import { HiOutlineSparkles } from 'react-icons/hi';
import { MdTrendingUp } from 'react-icons/md';

/**
 * Stacked coins — wallet balances, bundle prices, power-up costs.
 */
export function CoinIcon({ className = 'w-6 h-6', title, ...props }) {
  return (
    <GiTwoCoins
      className={`inline-block text-amber-500 dark:text-amber-400 ${className}`}
      aria-hidden={title ? undefined : true}
      title={title}
      {...props}
    />
  );
}

const powerupIconClass = {
  SHIELD: 'text-amber-600 dark:text-amber-400',
  FREEZE: 'text-sky-500 dark:text-sky-400',
  MULTIPLIER: 'text-emerald-600 dark:text-emerald-400',
};

/**
 * Visual for catalog / forms by backend powerup_type.
 */
export function PowerupTypeIcon({ type, className = 'w-12 h-12', title, ...props }) {
  const cn = `inline-block shrink-0 ${className}`;
  const color = powerupIconClass[type] || 'text-gray-500 dark:text-gray-400';
  const common = { className: `${cn} ${color}`, 'aria-hidden': title ? undefined : true, title, ...props };

  switch (type) {
    case 'SHIELD':
      return <GiShield {...common} />;
    case 'FREEZE':
      return <FaSnowflake {...common} />;
    case 'MULTIPLIER':
      return <MdTrendingUp {...common} />;
    default:
      return <HiOutlineSparkles {...common} />;
  }
}

export function powerupAccentBg(type) {
  switch (type) {
    case 'SHIELD':
      return 'bg-amber-50 dark:bg-amber-950/40 ring-amber-200/80 dark:ring-amber-800/60';
    case 'FREEZE':
      return 'bg-sky-50 dark:bg-sky-950/40 ring-sky-200/80 dark:ring-sky-800/60';
    case 'MULTIPLIER':
      return 'bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-200/80 dark:ring-emerald-800/60';
    default:
      return 'bg-gray-50 dark:bg-gray-800/80 ring-gray-200 dark:ring-gray-600';
  }
}
