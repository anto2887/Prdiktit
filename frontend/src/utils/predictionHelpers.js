export const getPredictionStatusInfo = (status, points = null) => {
  const statusConfig = {
    'EDITABLE': {
      label: 'Draft',
      color: 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
      icon: '📝',
      description: 'You can still edit this prediction'
    },
    'SUBMITTED': {
      label: 'Submitted',
      color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
      icon: '📤',
      description: 'Submitted and waiting for match start'
    },
    'LOCKED': {
      label: 'Locked',
      color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200',
      icon: '🔒',
      description: 'Match started - prediction locked'
    },
    'PROCESSED': {
      label: points === 3 ? 'Perfect!' : points === 1 ? 'Correct Result' : 'Processed',
      color: points === 3 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 
             points === 1 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200' : 
             'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200',
      icon: points === 3 ? '🎯' : points === 1 ? '✅' : points === 0 ? '❌' : '✔️',
      description: points === 3 ? 'Exact score match!' : 
                   points === 1 ? 'Got the result right' : 
                   points === 0 ? 'Better luck next time' : 'Match completed'
    }
  };

  return statusConfig[status] || {
    label: status,
    color: 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300',
    icon: '❓',
    description: 'Unknown status'
  };
};

export const getPointsBadgeColor = (points) => {
  if (points === null || points === undefined) return 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400';
  if (points === 3) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-bold';
  if (points === 1) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 font-bold';
  if (points === 0) return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 font-bold';
  return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300';
}; 