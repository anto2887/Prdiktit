import React from 'react';
import { TrendingUpIcon, CheckCircleIcon, StarIcon, UsersIcon } from 'lucide-react';

const StatCard = ({ title, value, description, icon: Icon, trend }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <div className="p-3 bg-blue-500 bg-opacity-10 rounded-full">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
      <div className="ml-5 w-0 flex-1">
        <dl>
          <dt className="text-sm font-medium text-gray-500 truncate">
            {title}
          </dt>
          <dd className="flex items-baseline">
            <div className="text-2xl font-semibold text-gray-900">
              {value}
            </div>
            {trend && (
              <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                trend > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend > 0 ? '↑' : '↓'}
                {Math.abs(trend)}%
              </div>
            )}
          </dd>
        </dl>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
    </div>
  </div>
);

const DashboardStats = ({ stats }) => {
  if (!stats) return null;

  const {
    totalPoints = 0,
    totalPredictions = 0,
    averagePoints = 0,
    perfectPredictions = 0,
    weeklyChange = 0
  } = stats;

  const statsConfig = [
    {
      title: 'Total Points',
      value: totalPoints,
      icon: StarIcon,
      trend: weeklyChange,
      description: 'Points earned from all predictions'
    },
    {
      title: 'Predictions Made',
      value: totalPredictions,
      icon: CheckCircleIcon,
      description: 'Total number of predictions'
    },
    {
      title: 'Average Points',
      value: averagePoints.toFixed(1),
      icon: TrendingUpIcon,
      description: 'Points per prediction'
    },
    {
      title: 'Perfect Predictions',
      value: perfectPredictions,
      icon: UsersIcon,
      description: 'Exactly correct predictions'
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statsConfig.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

export default DashboardStats;