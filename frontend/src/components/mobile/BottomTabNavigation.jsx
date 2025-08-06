// frontend/src/components/mobile/BottomTabNavigation.jsx
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const BottomTabNavigation = () => {
  const location = useLocation();

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      path: '/',
      icon: HomeIcon,
      activeIcon: HomeIconSolid
    },
    {
      id: 'groups',
      label: 'Groups',
      path: '/groups',
      icon: UsersIcon,
      activeIcon: UsersIconSolid
    },
    {
      id: 'predict',
      label: 'Predict',
      path: '/predictions',
      icon: ClipboardIcon,
      activeIcon: ClipboardIconSolid
    },
    {
      id: 'analytics',
      label: 'Analytics',
      path: '/analytics',
      icon: ChartIcon,
      activeIcon: ChartIconSolid
    },
    {
      id: 'profile',
      label: 'Profile',
      path: '/profile',
      icon: UserIcon,
      activeIcon: UserIconSolid
    }
  ];

  // Hide navigation on certain pages
  const hiddenPaths = ['/login', '/register', '/onboarding'];
  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path));

  if (shouldHide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="grid grid-cols-5 h-16">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center space-y-1 transition-colors ${
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="w-6 h-6">
                  {isActive ? <tab.activeIcon /> : <tab.icon />}
                </div>
                <span className="text-xs font-medium">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

// Icon components
const HomeIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const HomeIconSolid = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const UsersIconSolid = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const ClipboardIconSolid = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
    <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a2 2 0 002 2h4a2 2 0 002-2V3a2 2 0 012 2v6h-3a1 1 0 100 2h3v3a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm5 4a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const ChartIconSolid = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const UserIconSolid = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

export default BottomTabNavigation;

// ===== MOBILE PREDICTION CARD =====

// frontend/src/components/mobile/MobilePredictionCard.jsx
export const MobilePredictionCard = ({ 
  fixture, 
  prediction, 
  onUpdatePrediction, 
  isLocked = false 
}) => {
  const [homeScore, setHomeScore] = useState(prediction?.home_score || '');
  const [awayScore, setAwayScore] = useState(prediction?.away_score || '');
  const [isEditing, setIsEditing] = useState(false);

  const isMatchStarted = fixture?.status !== 'NOT_STARTED';
  const hasResult = fixture?.home_score !== null;
  const deadline = fixture?.date ? new Date(fixture.date) : null;
  const timeUntilDeadline = deadline ? deadline.getTime() - Date.now() : 0;

  const handleSave = async () => {
    if (homeScore !== '' && awayScore !== '') {
      await onUpdatePrediction({
        match_id: fixture.fixture_id,
        home_score: parseInt(homeScore),
        away_score: parseInt(awayScore)
      });
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setHomeScore(prediction?.home_score || '');
    setAwayScore(prediction?.away_score || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Match header */}
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 font-medium">
            {fixture?.league}
          </div>
          <div className="text-xs text-gray-500">
            {deadline && new Date(deadline).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
        
        {/* Teams */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1">
            {fixture?.home_team_logo && (
              <img 
                src={fixture.home_team_logo} 
                alt={fixture.home_team}
                className="w-6 h-6 object-contain"
              />
            )}
            <span className="font-medium text-sm truncate">
              {fixture?.home_team}
            </span>
          </div>
          
          <span className="text-gray-400 text-sm mx-3">vs</span>
          
          <div className="flex items-center space-x-2 flex-1 justify-end">
            <span className="font-medium text-sm truncate">
              {fixture?.away_team}
            </span>
            {fixture?.away_team_logo && (
              <img 
                src={fixture.away_team_logo} 
                alt={fixture.away_team}
                className="w-6 h-6 object-contain"
              />
            )}
          </div>
        </div>
      </div>

      {/* Prediction section */}
      <div className="p-4">
        {isLocked || isMatchStarted ? (
          <PredictionDisplay 
            prediction={prediction}
            fixture={fixture}
            hasResult={hasResult}
          />
        ) : isEditing ? (
          <PredictionEditor
            homeScore={homeScore}
            awayScore={awayScore}
            onHomeScoreChange={setHomeScore}
            onAwayScoreChange={setAwayScore}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <PredictionView
            prediction={prediction}
            onEdit={() => setIsEditing(true)}
            timeUntilDeadline={timeUntilDeadline}
          />
        )}
      </div>
    </div>
  );
};

// Prediction display for completed matches
const PredictionDisplay = ({ prediction, fixture, hasResult }) => {
  const points = prediction?.points || 0;
  const predictedScore = prediction ? `${prediction.home_score}-${prediction.away_score}` : 'No prediction';
  const actualScore = hasResult ? `${fixture.home_score}-${fixture.away_score}` : 'In progress';

  let accuracyClass = 'bg-gray-100 text-gray-800';
  let accuracyText = 'Pending';
  
  if (hasResult && prediction) {
    if (points === 3) {
      accuracyClass = 'bg-green-100 text-green-800';
      accuracyText = '🎯 Perfect!';
    } else if (points === 1) {
      accuracyClass = 'bg-yellow-100 text-yellow-800';
      accuracyText = '✓ Correct result';
    } else {
      accuracyClass = 'bg-red-100 text-red-800';
      accuracyText = '✗ Wrong';
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">Your prediction</div>
          <div className="text-lg font-bold text-gray-900">{predictedScore}</div>
        </div>
        
        {hasResult && (
          <div className="text-right">
            <div className="text-sm text-gray-600">Actual result</div>
            <div className="text-lg font-bold text-gray-900">{actualScore}</div>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${accuracyClass}`}>
          {accuracyText}
        </span>
        
        {hasResult && (
          <span className="text-sm font-medium text-gray-900">
            {points} point{points !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};

// Prediction editor for active editing
const PredictionEditor = ({ 
  homeScore, 
  awayScore, 
  onHomeScoreChange, 
  onAwayScoreChange, 
  onSave, 
  onCancel 
}) => {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-900 text-center">
        Enter your prediction
      </div>
      
      <div className="flex items-center justify-center space-x-4">
        <input
          type="number"
          value={homeScore}
          onChange={(e) => onHomeScoreChange(e.target.value)}
          min="0"
          max="20"
          className="w-16 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="0"
        />
        
        <span className="text-lg font-medium text-gray-500">-</span>
        
        <input
          type="number"
          value={awayScore}
          onChange={(e) => onAwayScoreChange(e.target.value)}
          min="0"
          max="20"
          className="w-16 h-12 text-center text-lg font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="0"
        />
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={homeScore === '' || awayScore === ''}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  );
};

// Prediction view for existing predictions
const PredictionView = ({ prediction, onEdit, timeUntilDeadline }) => {
  const predictedScore = prediction ? `${prediction.home_score}-${prediction.away_score}` : null;
  const canEdit = timeUntilDeadline > 0;

  return (
    <div className="space-y-3">
      {predictedScore ? (
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Your prediction</div>
          <div className="text-2xl font-bold text-gray-900">{predictedScore}</div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="text-gray-500 mb-2">No prediction yet</div>
        </div>
      )}
      
      {canEdit && (
        <button
          onClick={onEdit}
          className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {predictedScore ? 'Edit Prediction' : 'Make Prediction'}
        </button>
      )}
      
      {timeUntilDeadline <= 0 && !prediction && (
        <div className="text-center text-sm text-red-600">
          Prediction deadline has passed
        </div>
      )}
    </div>
  );
};

// ===== RIVALRY STATUS COMPONENT =====

// frontend/src/components/mobile/RivalryStatus.jsx
export const RivalryStatus = ({ rivalries, currentWeek, onViewDetails }) => {
  if (!rivalries || rivalries.length === 0) {
    return null;
  }

  const activeRivalries = rivalries.filter(r => r.is_active);
  const isRivalryWeek = activeRivalries.some(r => r.rivalry_week === currentWeek);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <span className="mr-2">🥊</span>
          Rivalries
          {isRivalryWeek && (
            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Active Week!
            </span>
          )}
        </h3>
        
        {activeRivalries.length > 0 && (
          <button
            onClick={onViewDetails}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View All
          </button>
        )}
      </div>

      {activeRivalries.length === 0 ? (
        <p className="text-sm text-gray-500">
          No active rivalries. Check back during rivalry weeks!
        </p>
      ) : (
        <div className="space-y-3">
          {activeRivalries.slice(0, 2).map((rivalry, index) => (
            <RivalryCard key={index} rivalry={rivalry} isRivalryWeek={isRivalryWeek} />
          ))}
          
          {activeRivalries.length > 2 && (
            <div className="text-center pt-2">
              <span className="text-sm text-gray-500">
                +{activeRivalries.length - 2} more rivalries
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RivalryCard = ({ rivalry, isRivalryWeek }) => {
  return (
    <div className={`p-3 rounded-lg border ${
      isRivalryWeek ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm text-gray-900">
            {rivalry.user1_name}
          </span>
          <span className="text-xs text-gray-500">vs</span>
          <span className="font-medium text-sm text-gray-900">
            {rivalry.user2_name}
          </span>
        </div>
        
        {rivalry.is_champion_challenge && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            👑 Champion Challenge
          </span>
        )}
      </div>
      
      {rivalry.record && (
        <div className="mt-2 text-xs text-gray-600">
          Record: {rivalry.record.wins}-{rivalry.record.losses}
          {rivalry.record.ties > 0 && `-${rivalry.record.ties}`}
        </div>
      )}
    </div>
  );
};