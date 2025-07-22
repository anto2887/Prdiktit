// Create frontend/src/components/common/TimezoneIndicator.jsx

import React, { useState } from 'react';
import { getTimezoneInfo } from '../../utils/dateUtils';

const TimezoneIndicator = ({ 
  className = '', 
  showDetails = false,
  showTooltip = true 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const timezoneInfo = getTimezoneInfo();
  
  const tooltipText = `All times shown in your local timezone: ${timezoneInfo.name} (${timezoneInfo.offset})`;
  
  if (showDetails) {
    return (
      <div className={`text-xs text-gray-600 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {timezoneInfo.abbreviation}
          </span>
          <span className="text-gray-400">•</span>
          <span>{timezoneInfo.offset}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {timezoneInfo.name}
        </div>
      </div>
    );
  }
  
  return (
    <span 
      className={`inline-flex items-center gap-1 text-xs text-gray-500 ${className}`}
      title={showTooltip ? tooltipText : undefined}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
      {timezoneInfo.abbreviation}
    </span>
  );
};

export default TimezoneIndicator;
