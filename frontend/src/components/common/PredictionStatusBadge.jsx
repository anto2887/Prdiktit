import React from 'react';
import { getPredictionStatusInfo } from '../../utils/predictionHelpers';

const PredictionStatusBadge = ({ status, points, showIcon = true, showTooltip = true }) => {
  const statusInfo = getPredictionStatusInfo(status, points);

  return (
    <div className="relative group">
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {showIcon && <span className="mr-1">{statusInfo.icon}</span>}
        {statusInfo.label}
      </span>
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
          {statusInfo.description}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default PredictionStatusBadge; 