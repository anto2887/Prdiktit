import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/AppContext';
import { useWeeklyStats } from '../../hooks/useWeeklyStats';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { useI18n } from '../../i18n';

export const PredictionStats = () => {
  const { t } = useI18n();
  const { profile, stats, loading: userLoading, error: userError } = useUser();
  const { 
    recentWeeksPerformance, 
    seasonTotals, 
    statistics, 
    loading: weeklyLoading, 
    error: weeklyError,
    hasData 
  } = useWeeklyStats({ recentWeeksCount: 5 });

  // Combined loading and error states
  const isLoading = userLoading || weeklyLoading;
  const error = userError || weeklyError;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  // Prepare chart data from real weekly performance
  const chartData = {
    pointsDistribution: [
      { label: t('profile.perfectScore3pts'), value: stats?.perfect_predictions || 0 },
      { label: t('profile.correctResult1pt'), value: stats?.correct_results || 0 },
      { label: t('profile.incorrect0pts'), value: stats?.incorrect_predictions || 0 }
    ],
    weeklyPerformance: recentWeeksPerformance
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('profile.predictionStats')}</h1>
        <Link
          to="/predictions/new"
          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          {t('predictions.makePrediction')}
        </Link>
      </div>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-blue-500 dark:border-blue-400">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.totalPoints')}</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.total_points || 0}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-500 dark:border-green-400">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.perfectPredictions')}</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.perfect_predictions || 0}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-yellow-500 dark:border-yellow-400">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('stats.correctResults')}</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.correct_results || 0}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-purple-500 dark:border-purple-400">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.averagePoints')}</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {(stats?.average_points || 0).toFixed(1)}
          </p>
        </div>
      </div>
      
      {/* Detailed Stats */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('profile.predictionAccuracy')}</h2>
        
        <div className="space-y-4">
          {chartData.pointsDistribution.map((item, index) => (
            <div key={index} className="relative pt-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold inline-block text-gray-600 dark:text-gray-400">
                    {item.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-gray-600 dark:text-gray-400">
                    {item.value} {t('profile.predictions')}
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                <div 
                  style={{ width: `${(item.value / Math.max(...chartData.pointsDistribution.map(d => d.value))) * 100}%` }}
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center 
                    ${index === 0 ? 'bg-green-500' : index === 1 ? 'bg-yellow-500' : 'bg-red-500'}`}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Weekly Performance */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('profile.weeklyPerformance')}</h2>
        
        {hasData && chartData.weeklyPerformance.length > 0 ? (
          <div className="h-64 flex items-end space-x-2">
            {chartData.weeklyPerformance.map((week, index) => (
              <div 
                key={index} 
                className="flex flex-col items-center"
                style={{ width: `${100 / chartData.weeklyPerformance.length}%` }}
              >
                <div 
                  className="w-full bg-blue-500 dark:bg-blue-400 rounded-t"
                  style={{ 
                    height: `${Math.max(20, (week.points / Math.max(...chartData.weeklyPerformance.map(w => w.points))) * 200)}px` 
                  }}
                ></div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('rivalries.week')} {week.week}</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{week.points} {t('profile.pts')}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{week.predictions} {t('profile.predictions')}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">📊</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('profile.noWeeklyDataYet')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {t('profile.noWeeklyDataBody')}
            </p>
          </div>
        )}
      </div>
      
      {/* Season Summary */}
      {hasData && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('profile.seasonSummary')}</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{statistics.totalWeeksWithData}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('profile.activeWeeks')}</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {statistics.averagePointsPerWeek.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('profile.avgPointsPerWeek')}</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {statistics.bestWeek ? statistics.bestWeek.points : 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('profile.bestWeekLabel')} {statistics.bestWeek ? `(${t('rivalries.week')} ${statistics.bestWeek.week})` : ''}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{statistics.consistencyScore}%</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('profile.consistency')}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Team Performance */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{t('profile.teamPerformance')}</h2>
        
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">
          {t('profile.teamPerformanceBody')}
        </p>
      </div>
    </div>
  );
};

export default PredictionStats;