// Create frontend/src/components/common/TimezoneIndicator.jsx

import React from 'react';
import { getUserTimezone, getTimezoneAbbreviation } from '../../utils/dateUtils';

const TimezoneIndicator = ({ className = '' }) => {
  const timezone = getUserTimezone();
  const abbreviation = getTimezoneAbbreviation();
  
  return (
    <span 
      className={`text-xs text-gray-500 ${className}`}
      title={`All times shown in your local timezone: ${timezone}`}
    >
      {abbreviation}
    </span>
  );
};

export default TimezoneIndicator;
