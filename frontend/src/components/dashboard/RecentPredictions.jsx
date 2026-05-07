// src/components/dashboard/RecentPredictions.jsx
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePredictions } from '../../contexts/AppContext';
import { formatDate } from '../../utils/dateUtils';
import { useI18n } from '../../i18n';

const RecentPredictions = () => {
  const { t } = useI18n();
  const { userPredictions, predictionsLoading } = usePredictions();

  // Debug logging
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('RecentPredictions: Component rendered');
      console.log('RecentPredictions: userPredictions:', userPredictions);
      console.log('RecentPredictions: predictionsLoading:', predictionsLoading);
      console.log('RecentPredictions: userPredictions type:', typeof userPredictions);
      console.log('RecentPredictions: userPredictions isArray:', Array.isArray(userPredictions));
      if (userPredictions && userPredictions.length > 0) {
        console.log('RecentPredictions: First prediction sample:', userPredictions[0]);
      }
    }
  }, [userPredictions, predictionsLoading]);

  const recentPredictions = useMemo(() => {
    if (!userPredictions || !Array.isArray(userPredictions)) return [];
    
    // Group predictions by fixture_id to handle duplicates
    const uniquePredictions = userPredictions.reduce((acc, pred) => {
      if (!pred.fixture) return acc;
      
      const fixtureId = pred.fixture.fixture_id;
      if (!acc[fixtureId] || new Date(pred.created) > new Date(acc[fixtureId].created)) {
        acc[fixtureId] = pred;
      }
      return acc;
    }, {});
    
    // Convert to array, sort by creation date, and take top 5
    return Object.values(uniquePredictions)
      .sort((a, b) => new Date(b.created) - new Date(a.created))
      .slice(0, 5);
  }, [userPredictions]);

  if (predictionsLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('recentPredictions.title')}
        </h3>
        <div className="animate-pulse">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="bg-gray-200 dark:bg-gray-700 h-4 w-4 rounded"></div>
                <div className="bg-gray-200 dark:bg-gray-700 h-4 flex-1 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!recentPredictions || recentPredictions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('recentPredictions.title')}
        </h3>
        {predictionsLoading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('recentPredictions.loading')}</p>
        ) : (
          <div>
                         <p className="text-gray-500 dark:text-gray-400 text-sm">
               {t('recentPredictions.emptyBody')}
             </p>
             <div className="mt-3">
               <Link
                 to="/predictions/new"
                 className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600"
               >
                 {t('recentPredictions.makeFirstPrediction')}
               </Link>
             </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                <p>Debug: userPredictions = {JSON.stringify(userPredictions)}</p>
                <p>Debug: predictionsLoading = {predictionsLoading}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('recentPredictions.title')}
        </h3>
        <Link
          to="/predictions/history"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
        >
          {t('recentPredictions.viewAll')} →
        </Link>
      </div>
      <div className="space-y-3">
        {recentPredictions.map((prediction) => (
          <div key={prediction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex-1">
                             <div className="flex items-center space-x-2">
                 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                   {prediction.fixture?.home_team} vs {prediction.fixture?.away_team}
                 </span>
                 {/* Show prediction status badge */}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
             prediction.prediction_status === 'PROCESSED' ? 
               (prediction.points === 3 ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 
                prediction.points === 1 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200') :
             prediction.prediction_status === 'EDITABLE' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
             prediction.prediction_status === 'SUBMITTED' ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' :
             prediction.prediction_status === 'LOCKED' ? 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200' :
             'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
           }`}>
             {prediction.prediction_status === 'PROCESSED' ? 
              (prediction.points === 3 ? t('recentPredictions.statusPerfect') : 
               prediction.points === 1 ? t('recentPredictions.statusPartial') : 
               prediction.points === 0 ? t('recentPredictions.statusIncorrect') : t('recentPredictions.statusPending')) :
              prediction.prediction_status === 'EDITABLE' ? t('recentPredictions.statusEditable') :
              prediction.prediction_status === 'SUBMITTED' ? t('recentPredictions.statusSubmitted') :
              prediction.prediction_status === 'LOCKED' ? t('recentPredictions.statusLocked') :
               prediction.prediction_status
             }
           </span>
               </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {prediction.score1} - {prediction.score2} • {formatDate(prediction.created)}
              </div>
            </div>
                         {/* Show match results for processed predictions, or match date for upcoming matches */}
             {prediction.prediction_status === 'PROCESSED' && prediction.fixture?.home_score !== null && (
               <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                 {prediction.fixture.home_score} - {prediction.fixture.away_score}
               </div>
             )}
             {prediction.prediction_status !== 'PROCESSED' && prediction.fixture?.date && (
               <div className="text-sm text-gray-500 dark:text-gray-400">
                 {formatDate(prediction.fixture.date)}
               </div>
             )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentPredictions;