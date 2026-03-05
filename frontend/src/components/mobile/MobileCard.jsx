import React from 'react';
import clsx from 'clsx';

const MobileCard = ({ children, onClick, className }) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'w-full text-left bg-white rounded-lg border border-gray-200 p-4 shadow-sm',
        onClick && 'transition-shadow active:shadow-md',
        className
      )}
    >
      {children}
    </Component>
  );
};

export default MobileCard;

