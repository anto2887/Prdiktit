// frontend/src/components/rivalries/RivalryDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth, useNotifications, useGroups } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import SeasonManager from '../../utils/seasonManager';

const RivalryDashboard = ({ groupId, currentWeek, season = null, group = null }) => {
  const [currentSeason, setCurrentSeason] = useState(season);

  // Get current season dynamically if not provided
  useEffect(() => {
    if (!currentSeason) {
      try {
        const season = SeasonManager.getCurrentSeason('Premier League');
        setCurrentSeason(season);
      } catch (error) {
        console.error('Error getting current season:', error);
        // Fallback to hardcoded season
        setCurrentSeason('2025-2026');
      }
    }
  }, [currentSeason]);
  
  const { user } = useAuth();
  const { showError } = useNotifications();
  const { currentGroup } = useGroups();
  
  const [rivalries, setRivalries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('current');
  const [comebackChallengeData, setComebackChallengeData] = useState(null);

  const pageGroup = group || currentGroup;
  const activationWeek = pageGroup?.activation_week || 5;
  const rivalriesActive = pageGroup?.is_activated ?? (currentWeek >= activationWeek);

  useEffect(() => {
    if (groupId && rivalriesActive) {
      loadRivalries();
      loadComebackChallengeData();
    }
  }, [groupId, rivalriesActive, currentSeason]);

  const loadRivalries = async () => {
    try {
      setLoading(true);
      process.env.NODE_ENV === 'development' && console.log(`Loading rivalries for group ${groupId}...`);
      
      // Use the proper API client with session authentication
      const { rivalriesApi } = await import('../../api');
      const payload = await rivalriesApi.getGroupRivalries(groupId);
      process.env.NODE_ENV === 'development' && console.log('Rivalries API response:', payload);

      // API client returns normalized payload: { status, message, data }
      const rivalriesArray = Array.isArray(payload?.data) ? payload.data : [];
      process.env.NODE_ENV === 'development' && console.log('Processed rivalries array:', rivalriesArray);
      setRivalries(rivalriesArray);

    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Error loading rivalries:', err);
      setError('Failed to load rivalry data');
      showError('Failed to load rivalries');
      // Ensure rivalries is always an array even on error
      setRivalries([]);
    } finally {
      setLoading(false);
    }
  };

  const loadComebackChallengeData = async () => {
    try {
      if (!groupId) return;
      
      process.env.NODE_ENV === 'development' && console.log(`Loading Comeback Challenge data for group ${groupId}...`);
      
      // Use the proper API client with session authentication
      const { rivalriesApi } = await import('../../api');
      const data = await rivalriesApi.getComebackChallengeStatus(groupId);
      if (data.success) {
        setComebackChallengeData(data);
        process.env.NODE_ENV === 'development' && console.log('Comeback Challenge data loaded:', data);
      }
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Error loading Comeback Challenge data:', err);
      // Don't show error to user for this - it's optional data
    }
  };

  // Show activation message if rivalries not yet available
  if (!rivalriesActive) {
    return <RivalryActivationMessage currentWeek={currentWeek} activationWeek={activationWeek} />;
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  // Ensure rivalries is an array before filtering
  const rivalriesArray = Array.isArray(rivalries) ? rivalries : [];
  process.env.NODE_ENV === 'development' && console.log('Filtering rivalries array:', rivalriesArray);
  
  const activeRivalries = rivalriesArray.filter(r => r.is_active);
  const historicalRivalries = rivalriesArray.filter(r => !r.is_active);
  const isRivalryWeek = activeRivalries.some(r => r.rivalry_week === currentWeek);

  process.env.NODE_ENV === 'development' && console.log('Active rivalries:', activeRivalries);
  process.env.NODE_ENV === 'development' && console.log('Historical rivalries:', historicalRivalries);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">🥊</span>
              Rivalries
              {isRivalryWeek && (
                <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  🔥 RIVALRY WEEK!
                </span>
              )}
            </h1>
            <p className="mt-2 text-gray-600">
              Compete head-to-head with your league rivals for bonus points
            </p>
          </div>
          
          {isRivalryWeek && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Bonus Points Available</div>
              <div className="text-2xl font-bold text-red-600">+3 pts</div>
            </div>
          )}
        </div>
      </div>

      {/* Comeback Challenge Section */}
      {comebackChallengeData && comebackChallengeData.group && comebackChallengeData.group.comeback_challenge_activated && (
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🎯</span>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-purple-900">Comeback Challenge Active</h3>
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold cursor-help"
                    title="Comeback Challenge is used only when the group has an odd number of members. The middle-position user in standings is selected as the comeback user and must beat the benchmark target. Even-sized groups use only standard rivalries."
                    aria-label="Comeback challenge explanation"
                  >
                    ?
                  </span>
                </div>
                <p className="text-sm text-purple-700">
                  Special challenge for users in the middle of the standings
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-purple-600">Challenge Status</div>
              <div className="text-lg font-bold text-purple-800">
                {comebackChallengeData.rivalries.filter(r => r.is_comeback_challenge).length} Active
              </div>
            </div>
          </div>
          
          {/* Comeback Challenge Rivalries */}
          {comebackChallengeData.rivalries.filter(r => r.is_comeback_challenge).map((rivalry, index) => (
            <div key={rivalry.rivalry_id} className="mt-4 p-4 bg-white rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-sm text-purple-600">Comeback User</div>
                    <div className="font-medium text-purple-900">{rivalry.user1.username}</div>
                  </div>
                  <div className="text-2xl text-purple-500">🥊</div>
                  <div className="text-center">
                    <div className="text-sm text-purple-600">Challenger</div>
                    <div className="font-medium text-purple-900">{rivalry.user2.username}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-purple-600">Target Score</div>
                  <div className="text-lg font-bold text-purple-800">
                    {rivalry.comeback_challenge_benchmark || 'N/A'}
                  </div>
                  <div className="text-xs text-purple-500">Average of 2 users above</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'current', label: 'Current Rivalries', count: activeRivalries.length },
            { id: 'history', label: 'History', count: historicalRivalries.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full ${
                  activeTab === tab.id
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'current' && (
          <CurrentRivalriesTab 
            rivalries={activeRivalries} 
            currentWeek={currentWeek}
            isRivalryWeek={isRivalryWeek}
            userId={user?.id}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab rivalries={historicalRivalries} userId={user?.id} />
        )}
      </div>
    </div>
  );
};

// Rivalry activation message
const RivalryActivationMessage = ({ currentWeek, activationWeek }) => (
  <div className="max-w-2xl mx-auto text-center py-12">
    <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
      <span className="text-4xl">🥊</span>
    </div>
    
    <h2 className="text-2xl font-bold text-gray-900 mb-4">
      Rivalries Incoming! 🔥
    </h2>
    
    <p className="text-lg text-gray-600 mb-4">
      Rivalry assignments will begin in <strong>Week {activationWeek}</strong>
    </p>
    
    <div className="bg-red-50 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-center space-x-4 mb-4">
        <div className="text-2xl font-bold text-red-600">Week {currentWeek}</div>
        <div className="text-gray-400">/</div>
        <div className="text-2xl font-bold text-gray-600">Week {activationWeek}</div>
      </div>
      
      <div className="w-full bg-red-200 rounded-full h-3">
        <div
          className="bg-red-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${Math.min((currentWeek / activationWeek) * 100, 100)}%` }}
        />
      </div>
      
      <p className="text-sm text-red-700 mt-3">
        {activationWeek - currentWeek} more weeks until rivalries activate
      </p>
    </div>
    
    <div className="text-left bg-gray-50 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-3">How Rivalries Work:</h3>
      <ul className="space-y-2 text-sm text-gray-600">
        <li className="flex items-center space-x-2">
          <span className="text-red-500">🥊</span>
          <span>Auto-assigned rivals based on performance proximity</span>
        </li>
        <li className="flex items-center space-x-2">
          <span className="text-red-500">👑</span>
          <span>Champion Challenge for odd-numbered groups</span>
        </li>
        <li className="flex items-center space-x-2">
          <span className="text-red-500">🏆</span>
          <span>+3 bonus points for beating your rival</span>
        </li>
        <li className="flex items-center space-x-2">
          <span className="text-red-500">📅</span>
          <span>Monthly rivalry weeks with special challenges</span>
        </li>
      </ul>
    </div>
  </div>
);

// Current rivalries tab
const CurrentRivalriesTab = ({ rivalries, currentWeek, isRivalryWeek, userId }) => {
  if (rivalries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-2xl">🤝</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Rivalries</h3>
        <p className="text-gray-500">
          Rivalries will be assigned based on group performance. Check back during rivalry weeks!
        </p>
      </div>
    );
  }

  const userRivalries = rivalries.filter(r => 
    r.user1_id === userId || r.user2_id === userId
  );

  const championChallenges = rivalries.filter(r => r.is_champion_challenge);
  const standardRivalries = rivalries.filter(r => !r.is_champion_challenge);

  return (
    <div className="space-y-8">
      {/* User's rivalries */}
      {userRivalries.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Rivalries</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {userRivalries.map((rivalry) => (
              <RivalryCard 
                key={rivalry.id} 
                rivalry={rivalry} 
                currentWeek={currentWeek}
                isRivalryWeek={isRivalryWeek}
                isUserCard={true}
                userId={userId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Champion challenges */}
      {championChallenges.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">👑</span>
            Champion Challenges
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {championChallenges.map((rivalry) => (
              <ChampionChallengeCard 
                key={rivalry.id} 
                rivalry={rivalry} 
                currentWeek={currentWeek}
                isRivalryWeek={isRivalryWeek}
              />
            ))}
          </div>
        </section>
      )}

      {/* Standard rivalries */}
      {standardRivalries.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Group Rivalries</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {standardRivalries.map((rivalry) => (
              <RivalryCard 
                key={rivalry.id} 
                rivalry={rivalry} 
                currentWeek={currentWeek}
                isRivalryWeek={isRivalryWeek}
                isUserCard={false}
                userId={userId}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// History tab
const HistoryTab = ({ rivalries, userId }) => {
  if (rivalries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-2xl">📚</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Rivalry History</h3>
        <p className="text-gray-500">
          Past rivalries and outcomes will appear here after rivalry weeks conclude.
        </p>
      </div>
    );
  }

  // Group by rivalry week
  const rivalriesByWeek = rivalries.reduce((acc, rivalry) => {
    const week = rivalry.rivalry_week;
    if (!acc[week]) acc[week] = [];
    acc[week].push(rivalry);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(rivalriesByWeek)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .map(([week, weekRivalries]) => (
          <div key={week} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Week {week} Rivalries
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {weekRivalries.map((rivalry) => (
                <HistoricalRivalryCard 
                  key={rivalry.id} 
                  rivalry={rivalry} 
                  userId={userId}
                />
              ))}
            </div>
          </div>
        ))
      }
    </div>
  );
};

// Individual rivalry card
const RivalryCard = ({ rivalry, currentWeek, isRivalryWeek, isUserCard, userId }) => {
  const isUserInvolved = rivalry.user1_id === userId || rivalry.user2_id === userId;
  const userPosition = rivalry.user1_id === userId ? 'user1' : 'user2';
  const opponentPosition = userPosition === 'user1' ? 'user2' : 'user1';
  
  return (
    <div className={`rounded-lg border-2 p-6 transition-all ${
      isRivalryWeek 
        ? 'border-red-300 bg-red-50' 
        : 'border-gray-200 bg-white'
    } ${isUserCard ? 'ring-2 ring-blue-200' : ''}`}>
      
      {/* Rivalry header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🥊</span>
          {!rivalry.is_comeback_challenge && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Standard Rivalry
            </span>
          )}
          {rivalry.is_comeback_challenge && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              🎯 Comeback Challenge
            </span>
          )}
          {rivalry.is_champion_challenge && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              👑 Champion Challenge
            </span>
          )}
        </div>
        
        {isRivalryWeek && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            🔥 Active
          </span>
        )}
      </div>

      {/* Rival matchup */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-center flex-1">
          <div className={`font-bold ${
            isUserInvolved && userPosition === 'user1' ? 'text-blue-600' : 'text-gray-900'
          }`}>
            {rivalry.user1_name}
          </div>
          <div className="text-sm text-gray-500">
            {rivalry.user1_rank ? `#${rivalry.user1_rank}` : 'Rank N/A'}
          </div>
        </div>
        
        <div className="mx-4">
          <span className="text-gray-400 font-bold">VS</span>
        </div>
        
        <div className="text-center flex-1">
          <div className={`font-bold ${
            isUserInvolved && userPosition === 'user2' ? 'text-blue-600' : 'text-gray-900'
          }`}>
            {rivalry.user2_name}
          </div>
          <div className="text-sm text-gray-500">
            {rivalry.user2_rank ? `#${rivalry.user2_rank}` : 'Rank N/A'}
          </div>
        </div>
      </div>

      {/* Current week scores (if rivalry week) */}
      {isRivalryWeek && rivalry.current_week_scores && (
        <div className="mb-4 p-3 bg-white rounded-lg border">
          <div className="text-sm font-medium text-gray-700 mb-2">This Week&apos;s Performance</div>
          <div className="flex justify-between text-sm">
            <span>{rivalry.user1_name}: {rivalry.current_week_scores.user1_points} pts</span>
            <span>{rivalry.user2_name}: {rivalry.current_week_scores.user2_points} pts</span>
          </div>
        </div>
      )}

      {/* Comeback challenge benchmark details */}
      {rivalry.is_comeback_challenge && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-sm font-medium text-purple-800 mb-2">Comeback Target</div>
          <div className="text-sm text-purple-700">
            Benchmark: <span className="font-semibold">{rivalry.comeback_challenge_benchmark ?? 'N/A'}</span>
          </div>
          <div className="text-sm text-purple-700">
            Achieved: <span className="font-semibold">{rivalry.current_week_scores?.user1_points ?? rivalry.final_scores?.user1_points ?? 0}</span>
          </div>
          <div className="text-xs mt-2 text-purple-700">
            Status: {rivalry.comeback_challenge_status === 'completed' ? 'Bonus earned' : rivalry.comeback_challenge_status === 'failed' ? 'Target missed (no bonus)' : 'Pending'}
          </div>
        </div>
      )}

      {/* Rivalry record */}
      {rivalry.record && (
        <div className="text-center">
          <div className="text-sm text-gray-600">Head-to-Head Record</div>
          <div className="font-medium">
            {isUserInvolved ? (
              <span>
                {rivalry.record[`${userPosition}_wins`]}-{rivalry.record[`${opponentPosition}_wins`]}
                {rivalry.record.ties > 0 && `-${rivalry.record.ties}`}
              </span>
            ) : (
              <span>
                {rivalry.record.user1_wins}-{rivalry.record.user2_wins}
                {rivalry.record.ties > 0 && `-${rivalry.record.ties}`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Champion challenge card (special layout)
const ChampionChallengeCard = ({ rivalry, currentWeek, isRivalryWeek }) => (
  <div className={`rounded-lg border-2 p-6 ${
    isRivalryWeek 
      ? 'border-yellow-300 bg-yellow-50' 
      : 'border-gray-200 bg-white'
  }`}>
    
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <span className="text-2xl">👑</span>
        <span className="font-bold text-yellow-800">Champion Challenge</span>
      </div>
      
      {isRivalryWeek && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          🔥 Active
        </span>
      )}
    </div>

    {/* Champion vs multiple challengers layout */}
    <div className="space-y-4">
      {/* Champion */}
      <div className="text-center p-3 bg-yellow-100 rounded-lg">
        <div className="font-bold text-yellow-900 flex items-center justify-center space-x-2">
          <span>👑</span>
          <span>{rivalry.champion_name}</span>
          <span>👑</span>
        </div>
        <div className="text-sm text-yellow-700">
          {rivalry.champion_rank ? `Rank #${rivalry.champion_rank}` : 'Champion'}
        </div>
      </div>
      
      <div className="text-center text-gray-500 font-medium">VS</div>
      
      {/* Challengers */}
      <div className="space-y-2">
        {rivalry.challengers?.map((challenger, index) => (
          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="font-medium">{challenger.name}</span>
            <span className="text-sm text-gray-500">
              {challenger.rank ? `#${challenger.rank}` : 'Challenger'}
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* Champion challenge rules */}
    <div className="mt-4 p-3 bg-white rounded border text-sm">
      <div className="font-medium text-gray-900 mb-1">Challenge Rules:</div>
      <ul className="text-gray-600 text-xs space-y-1">
        <li>• Champion must beat ALL challengers to win</li>
        <li>• Challengers only need to beat the champion</li>
        <li>• +3 bonus points for winners</li>
      </ul>
    </div>
  </div>
);

// Historical rivalry card
const HistoricalRivalryCard = ({ rivalry, userId }) => {
  const isUserInvolved = rivalry.user1_id === userId || rivalry.user2_id === userId;
  const userWon = rivalry.winner_id === userId;
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-gray-900">
          {rivalry.user1_name} vs {rivalry.user2_name}
        </div>
        
        {rivalry.is_comeback_challenge ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            🎯 Comeback
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Standard
          </span>
        )}

        {rivalry.is_champion_challenge && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            👑 Champion
          </span>
        )}
      </div>
      
      {/* Final scores */}
      <div className="flex justify-between text-sm mb-2">
        <span className={rivalry.winner_id === rivalry.user1_id ? 'font-bold text-green-600' : ''}>
          {rivalry.user1_name}: {rivalry.final_scores?.user1_points || 0} pts
        </span>
        <span className={rivalry.winner_id === rivalry.user2_id ? 'font-bold text-green-600' : ''}>
          {rivalry.user2_name}: {rivalry.final_scores?.user2_points || 0} pts
        </span>
      </div>
      
      {/* Outcome */}
      <div className="text-center">
        {rivalry.winner_id ? (
          <div className={`text-sm font-medium ${
            isUserInvolved
              ? userWon ? 'text-green-600' : 'text-red-600'
              : 'text-gray-600'
          }`}>
            {rivalry.winner_name} won
            {isUserInvolved && (
              <span className="ml-1">
                {userWon ? '🎉' : '😔'}
              </span>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Tie</div>
        )}
      </div>

      {rivalry.is_comeback_challenge && (
        <div className="mt-2 text-xs text-purple-700 text-center">
          Benchmark: {rivalry.comeback_challenge_benchmark ?? 'N/A'} | Status: {rivalry.comeback_challenge_status === 'completed' ? 'Bonus earned' : rivalry.comeback_challenge_status === 'failed' ? 'Target missed' : 'Pending'}
        </div>
      )}
    </div>
  );
};

export default RivalryDashboard;

// ===== COMPACT RIVALRY WIDGET =====

export const CompactRivalryWidget = ({ groupId, currentWeek, userId }) => {
  const [rivalries, setRivalries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (groupId && currentWeek >= 5) {
      loadCompactRivalries();
    }
  }, [groupId, currentWeek]);

  const loadCompactRivalries = async () => {
    try {
      setLoading(true);
      process.env.NODE_ENV === 'development' && console.log(`Loading compact rivalries for group ${groupId}...`);
      
      // Use the proper API client with session authentication
      const { rivalriesApi } = await import('../../api');
      const payload = await rivalriesApi.getGroupRivalries(groupId);
      process.env.NODE_ENV === 'development' && console.log('Compact rivalries API response:', payload);
      // API client returns normalized payload: { status, message, data }
      const rivalriesArray = Array.isArray(payload?.data) ? payload.data : [];
      process.env.NODE_ENV === 'development' && console.log('Processed compact rivalries array:', rivalriesArray);
      setRivalries(rivalriesArray);
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Error loading compact rivalries:', err);
      setRivalries([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading || currentWeek < 5) return null;

  // Ensure rivalries is an array before filtering
  const rivalriesArray = Array.isArray(rivalries) ? rivalries : [];
  const userRivalries = rivalriesArray.filter(r => 
    r.is_active && (r.user1_id === userId || r.user2_id === userId)
  );

  const isRivalryWeek = rivalriesArray.some(r => r.rivalry_week === currentWeek);

  if (userRivalries.length === 0) return null;

  return (
    <div className={`bg-white rounded-lg border-2 p-4 ${
      isRivalryWeek ? 'border-red-300 bg-red-50' : 'border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 flex items-center">
          <span className="mr-2">🥊</span>
          Your Rivalries
          {isRivalryWeek && (
            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Active!
            </span>
          )}
        </h4>
      </div>

      <div className="space-y-3">
        {userRivalries.slice(0, 2).map((rivalry) => (
          <CompactRivalryItem key={rivalry.id} rivalry={rivalry} userId={userId} />
        ))}
      </div>

      {userRivalries.length > 2 && (
        <div className="mt-3 text-center">
          <span className="text-xs text-gray-500">
            +{userRivalries.length - 2} more rivalries
          </span>
        </div>
      )}
    </div>
  );
};

const CompactRivalryItem = ({ rivalry, userId }) => {
  const isUser1 = rivalry.user1_id === userId;
  const opponentName = isUser1 ? rivalry.user2_name : rivalry.user1_name;
  const userWins = isUser1 ? rivalry.record?.user1_wins : rivalry.record?.user2_wins;
  const opponentWins = isUser1 ? rivalry.record?.user2_wins : rivalry.record?.user1_wins;

  return (
    <div className="flex items-center justify-between p-2 bg-white rounded border">
      <div className="flex items-center space-x-2">
        <span className="text-sm">🥊</span>
        <span className="font-medium text-sm">vs {opponentName}</span>
        {rivalry.is_champion_challenge && (
          <span className="text-xs">👑</span>
        )}
      </div>
      
      <div className="text-right">
        <div className="text-xs font-medium">
          {userWins || 0}-{opponentWins || 0}
        </div>
        <div className="text-xs text-gray-500">
          {rivalry.record?.ties > 0 && `${rivalry.record.ties} ties`}
        </div>
      </div>
    </div>
  );
};

// ===== RIVALRY WEEK BANNER =====

export const RivalryWeekBanner = ({ isRivalryWeek, currentWeek }) => {
  if (!isRivalryWeek) return null;

  return (
    <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">🔥</span>
          <div>
            <h3 className="font-bold text-lg">RIVALRY WEEK {currentWeek}!</h3>
            <p className="text-red-100 text-sm">
              Beat your rivals to earn +3 bonus points
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold">+3</div>
          <div className="text-xs text-red-100">bonus pts</div>
        </div>
      </div>
    </div>
  );
};

// ===== MOBILE RIVALRY CARD =====

export const MobileRivalryCard = ({ rivalry, currentWeek, isRivalryWeek, userId }) => {
  const isUserInvolved = rivalry.user1_id === userId || rivalry.user2_id === userId;
  const userPosition = rivalry.user1_id === userId ? 'user1' : 'user2';
  const opponentName = userPosition === 'user1' ? rivalry.user2_name : rivalry.user1_name;
  
  return (
    <div className={`rounded-lg border p-4 ${
      isRivalryWeek 
        ? 'border-red-300 bg-red-50' 
        : 'border-gray-200 bg-white'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🥊</span>
          {rivalry.is_champion_challenge && (
            <span className="text-xs">👑</span>
          )}
        </div>
        
        {isRivalryWeek && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Active
          </span>
        )}
      </div>

      {/* Matchup - simplified for mobile */}
      <div className="text-center mb-3">
        <div className="font-medium text-gray-900">
          {isUserInvolved ? `You vs ${opponentName}` : `${rivalry.user1_name} vs ${rivalry.user2_name}`}
        </div>
        
        {rivalry.record && (
          <div className="text-sm text-gray-600 mt-1">
            Record: {rivalry.record.user1_wins}-{rivalry.record.user2_wins}
            {rivalry.record.ties > 0 && `-${rivalry.record.ties}`}
          </div>
        )}
      </div>

      {/* Current week performance (if rivalry week) */}
      {isRivalryWeek && rivalry.current_week_scores && (
        <div className="bg-white rounded p-2 text-sm">
          <div className="flex justify-between">
            <span>You: {rivalry.current_week_scores[`${userPosition}_points`] || 0} pts</span>
            <span>{opponentName}: {rivalry.current_week_scores[`${userPosition === 'user1' ? 'user2' : 'user1'}_points`] || 0} pts</span>
          </div>
        </div>
      )}
    </div>
  );
};