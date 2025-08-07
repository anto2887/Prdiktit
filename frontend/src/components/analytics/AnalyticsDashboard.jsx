// frontend/src/components/analytics/AnalyticsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const AnalyticsDashboard = ({ season = '2024-2025', currentWeek = 1 }) => {
  const { user } = useAuth();
  const { showError } = useNotifications();
  
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const ACTIVATION_WEEK = 5;
  const analyticsAvailable = currentWeek >= ACTIVATION_WEEK;

  useEffect(() => {
    if (user && analyticsAvailable) {
      loadAnalytics();
    }
  }, [user, season, currentWeek]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/analytics/user/${user.id}/analytics?season=${season}&week=${currentWeek}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }

      const data = await response.json();
      setAnalytics(data.data);

    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
      showError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Show activation message if analytics not yet available
  if (!analyticsAvailable) {
    return <AnalyticsActivationMessage currentWeek={currentWeek} activationWeek={ACTIVATION_WEEK} />;
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!analytics) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">📊 Your Analytics</h1>
        <p className="mt-2 text-gray-600">
          Detailed insights into your prediction performance and patterns
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: '📈' },
            { id: 'trends', label: 'Trends', icon: '📊' },
            { id: 'teams', label: 'Teams', icon: '⚽' },
            { id: 'patterns', label: 'Patterns', icon: '🎯' },
            { id: 'streaks', label: 'Streaks', icon: '🔥' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'overview' && <OverviewTab analytics={analytics} />}
        {activeTab === 'trends' && <TrendsTab analytics={analytics} />}
        {activeTab === 'teams' && <TeamsTab analytics={analytics} />}
        {activeTab === 'patterns' && <PatternsTab analytics={analytics} />}
        {activeTab === 'streaks' && <StreaksTab analytics={analytics} />}
      </div>
    </div>
  );
};

// Analytics activation message
const AnalyticsActivationMessage = ({ currentWeek, activationWeek }) => (
  <div className="max-w-2xl mx-auto text-center py-12">
    <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
      <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </div>
    
    <h2 className="text-2xl font-bold text-gray-900 mb-4">
      Analytics Coming Soon! 📊
    </h2>
    
    <p className="text-lg text-gray-600 mb-4">
      Personal analytics will be available starting in <strong>Week {activationWeek}</strong>
    </p>
    
    <div className="bg-blue-50 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-center space-x-4 mb-4">
        <div className="text-2xl font-bold text-blue-600">Week {currentWeek}</div>
        <div className="text-gray-400">/</div>
        <div className="text-2xl font-bold text-gray-600">Week {activationWeek}</div>
      </div>
      
      <div className="w-full bg-blue-200 rounded-full h-3">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${Math.min((currentWeek / activationWeek) * 100, 100)}%` }}
        />
      </div>
      
      <p className="text-sm text-blue-700 mt-3">
        {activationWeek - currentWeek} more weeks until analytics unlock
      </p>
    </div>
    
    <div className="text-left bg-gray-50 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-3">What you'll get:</h3>
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex items-center space-x-2">
          <span className="text-green-500">✓</span>
          <span>Performance trends and progression charts</span>
        </li>
        <li className="flex items-center space-x-2">
          <span className="text-green-500">✓</span>
          <span>Strong/weak team matchup analysis</span>
        </li>
        <li className="flex items-center space-x-2">
          <span className="text-green-500">✓</span>
          <span>Prediction pattern insights</span>
        </li>
        <li className="flex items-center space-x-2">
          <span className="text-green-500">✓</span>
          <span>Hot and cold streak tracking</span>
        </li>
        <li className="flex items-center space-x-2">
          <span className="text-green-500">✓</span>
          <span>Personalized improvement suggestions</span>
        </li>
      </ul>
    </div>
  </div>
);

// Overview tab - summary stats
const OverviewTab = ({ analytics }) => {
  const summary = analytics.summary || {};
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Key metrics cards */}
      <MetricCard
        title="Total Points"
        value={summary.total_points || 0}
        subtitle={`${summary.total_predictions || 0} predictions`}
        icon="🎯"
        color="blue"
      />
      
      <MetricCard
        title="Accuracy Rate"
        value={`${(summary.accuracy_percentage || 0).toFixed(1)}%`}
        subtitle={summary.skill_level || 'Getting started'}
        icon="📈"
        color="green"
      />
      
      <MetricCard
        title="Perfect Predictions"
        value={summary.perfect_predictions || 0}
        subtitle="Exact score matches"
        icon="🎯"
        color="purple"
      />
      
      <MetricCard
        title="Average Points"
        value={(summary.average_points || 0).toFixed(1)}
        subtitle="Per prediction"
        icon="⭐"
        color="yellow"
      />
    </div>
  );
};

// Trends tab - performance over time
const TrendsTab = ({ analytics }) => {
  const trends = analytics.performance_trends || {};
  const weeklyData = trends.weekly_performance || [];
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Performance</h3>
        
        {weeklyData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {weeklyData.slice(-5).map((week, index) => (
              <WeeklyPerformanceCard key={week.week} weekData={week} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Not enough data yet. Keep making predictions!
          </p>
        )}
      </div>
      
      {trends.improvement_trend && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trend</h3>
          <div className={`p-4 rounded-lg ${
            trends.improvement_trend === 'improving' 
              ? 'bg-green-50 text-green-800' 
              : trends.improvement_trend === 'declining'
              ? 'bg-red-50 text-red-800'
              : 'bg-blue-50 text-blue-800'
          }`}>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">
                {trends.improvement_trend === 'improving' ? '📈' : 
                 trends.improvement_trend === 'declining' ? '📉' : '➡️'}
              </span>
              <span className="font-medium">
                Your predictions are {trends.improvement_trend}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Teams tab - team-specific performance
const TeamsTab = ({ analytics }) => {
  const teamPerformance = analytics.team_performance || {};
  const strongTeams = teamPerformance.strong_teams || [];
  const weakTeams = teamPerformance.weak_teams || [];
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Strong teams */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">💪</span>
          Your Strong Teams
        </h3>
        
        {strongTeams.length > 0 ? (
          <div className="space-y-3">
            {strongTeams.slice(0, 5).map((team, index) => (
              <TeamPerformanceItem 
                key={team.team_name} 
                team={team} 
                rank={index + 1}
                type="strong"
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            Keep predicting to discover your strong teams!
          </p>
        )}
      </div>
      
      {/* Weak teams */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🎯</span>
          Improvement Opportunities
        </h3>
        
        {weakTeams.length > 0 ? (
          <div className="space-y-3">
            {weakTeams.slice(0, 5).map((team, index) => (
              <TeamPerformanceItem 
                key={team.team_name} 
                team={team} 
                rank={index + 1}
                type="weak"
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No weak spots identified yet!
          </p>
        )}
      </div>
    </div>
  );
};

// Patterns tab - prediction patterns
const PatternsTab = ({ analytics }) => {
  const patterns = analytics.prediction_patterns || {};
  
  return (
    <div className="space-y-6">
      {/* Prediction insights */}
      {patterns.insights && patterns.insights.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 Prediction Insights</h3>
          
          <div className="space-y-4">
            {patterns.insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
                <span className="text-2xl">💡</span>
                <div>
                  <p className="text-blue-900 font-medium">{insight.title}</p>
                  <p className="text-blue-700 text-sm mt-1">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Score tendencies */}
      {patterns.score_tendencies && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Your Prediction Tendencies</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Most predicted scores */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Most Predicted Scores</h4>
              <div className="space-y-2">
                {patterns.score_tendencies.most_common?.slice(0, 5).map((score, index) => (
                  <div key={score.score} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{score.score}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(score.count / patterns.score_tendencies.most_common[0].count) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{score.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Prediction style */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Your Style</h4>
              <div className="space-y-3">
                {patterns.style_indicators?.map((indicator, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="text-lg">{indicator.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{indicator.label}</p>
                      <p className="text-xs text-gray-600">{indicator.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Streaks tab - hot/cold streaks
const StreaksTab = ({ analytics }) => {
  const streaks = analytics.streaks || {};
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Current streaks */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Current Streaks</h3>
        
        <div className="space-y-4">
          {streaks.current_streaks?.map((streak, index) => (
            <StreakCard key={index} streak={streak} isCurrent={true} />
          ))}
          
          {(!streaks.current_streaks || streaks.current_streaks.length === 0) && (
            <p className="text-gray-500 text-center py-4 text-sm">
              No active streaks
            </p>
          )}
        </div>
      </div>
      
      {/* Best streaks */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 Best Streaks</h3>
        
        <div className="space-y-4">
          {streaks.best_streaks?.map((streak, index) => (
            <StreakCard key={index} streak={streak} isCurrent={false} />
          ))}
          
          {(!streaks.best_streaks || streaks.best_streaks.length === 0) && (
            <p className="text-gray-500 text-center py-4 text-sm">
              Keep predicting to build streaks!
            </p>
          )}
        </div>
      </div>
      
      {/* Streak tips */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Streak Tips</h3>
        
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm font-medium text-yellow-800">Hot Streaks</p>
            <p className="text-xs text-yellow-700 mt-1">
              3+ correct predictions in a row
            </p>
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-800">Perfect Streaks</p>
            <p className="text-xs text-green-700 mt-1">
              2+ perfect score predictions in a row
            </p>
          </div>
          
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-800">Pro Tip</p>
            <p className="text-xs text-blue-700 mt-1">
              Conservative predictions help maintain streaks
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Supporting components

const MetricCard = ({ title, value, subtitle, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
};

const WeeklyPerformanceCard = ({ weekData }) => {
  const accuracy = weekData.prediction_count > 0 
    ? ((weekData.correct_predictions + weekData.perfect_predictions) / weekData.prediction_count * 100).toFixed(0)
    : 0;

  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <div className="text-sm font-medium text-gray-600 mb-1">Week {weekData.week}</div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{weekData.total_points}</div>
      <div className="text-xs text-gray-500">{accuracy}% accuracy</div>
      
      {weekData.bonus_type && (
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {weekData.bonus_type === 'perfect_week' ? '3x' : '2x'} Bonus!
          </span>
        </div>
      )}
    </div>
  );
};

const TeamPerformanceItem = ({ team, rank, type }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div className="flex items-center space-x-3">
      <span className="text-sm font-medium text-gray-600">#{rank}</span>
      <span className="font-medium text-gray-900">{team.team_name}</span>
    </div>
    
    <div className="text-right">
      <div className="text-sm font-medium text-gray-900">
        {team.accuracy?.toFixed(0)}% accuracy
      </div>
      <div className="text-xs text-gray-500">
        {team.predictions_count} predictions
      </div>
    </div>
  </div>
);

const StreakCard = ({ streak, isCurrent }) => {
  const streakIcons = {
    hot: '🔥',
    perfect: '🎯',
    cold: '❄️'
  };

  const streakColors = {
    hot: 'bg-orange-50 text-orange-800',
    perfect: 'bg-green-50 text-green-800',
    cold: 'bg-blue-50 text-blue-800'
  };

  return (
    <div className={`p-3 rounded-lg ${streakColors[streak.type] || 'bg-gray-50 text-gray-800'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{streakIcons[streak.type] || '📊'}</span>
          <span className="font-medium text-sm capitalize">{streak.type} Streak</span>
        </div>
        <span className="font-bold text-lg">{streak.count}</span>
      </div>
      
      {streak.description && (
        <p className="text-xs mt-1 opacity-75">{streak.description}</p>
      )}
    </div>
  );
};

export default AnalyticsDashboard;