export const getPredictionStatusInfo = (status, points = null) => {
  const statusConfig = {
    'EDITABLE': {
      label: 'Draft',
      color: 'bg-gray-100 text-gray-700',
      icon: '📝',
      description: 'You can still edit this prediction'
    },
    'SUBMITTED': {
      label: 'Submitted',
      color: 'bg-blue-100 text-blue-700',
      icon: '📤',
      description: 'Submitted and waiting for match start'
    },
    'LOCKED': {
      label: 'Locked',
      color: 'bg-yellow-100 text-yellow-700',
      icon: '🔒',
      description: 'Match started - prediction locked'
    },
    'PROCESSED': {
      label: points === 3 ? 'Perfect!' : points === 1 ? 'Correct Result' : 'Processed',
      color: points === 3 ? 'bg-green-100 text-green-700' : 
             points === 1 ? 'bg-yellow-100 text-yellow-700' : 
             'bg-red-100 text-red-700',
      icon: points === 3 ? '🎯' : points === 1 ? '✅' : points === 0 ? '❌' : '✔️',
      description: points === 3 ? 'Exact score match!' : 
                   points === 1 ? 'Got the result right' : 
                   points === 0 ? 'Better luck next time' : 'Match completed'
    }
  };

  return statusConfig[status] || {
    label: status,
    color: 'bg-gray-100 text-gray-600',
    icon: '❓',
    description: 'Unknown status'
  };
};

export const getPointsBadgeColor = (points) => {
  if (points === null || points === undefined) return 'bg-gray-100 text-gray-500';
  if (points === 3) return 'bg-green-100 text-green-800 font-bold';
  if (points === 1) return 'bg-yellow-100 text-yellow-800 font-bold';
  if (points === 0) return 'bg-red-100 text-red-800 font-bold';
  return 'bg-gray-100 text-gray-600';
}; 