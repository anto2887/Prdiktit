// src/pages/GroupDetailsPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  useUser, 
  useGroups, 
  useNotifications,
  useLeagueContext  // <-- Use this hook instead of direct imports
} from '../contexts/AppContext';
import SeasonSelector from '../components/common/SeasonSelector';
import SeasonManager from '../utils/seasonManager';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import GroupActivationProgress from '../components/common/GroupActivationProgress';
import ContextAwareNavigation from '../components/common/ContextAwareNavigation';
import MobileCard from '../components/mobile/MobileCard';
import AdSlot from '../components/ads/AdSlot';
import { useI18n } from '../i18n';

const GroupDetailsPage = () => {
  const { t } = useI18n();
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, fetchProfile, loading: userLoading } = useUser();
  const { 
    fetchGroupDetails, 
    fetchGroupMembers, 
    currentGroup, 
    groupMembers,
    loading: groupsLoading 
  } = useGroups();

  // Debug logging for state changes
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('📊 Groups Context State:', {
      currentGroup: currentGroup,
      groupMembersCount: groupMembers?.length || 0,
      groupsLoading,
      hasCurrentGroup: !!currentGroup,
      currentGroupId: currentGroup?.id,
      currentGroupLeague: currentGroup?.league
    });
  }, [currentGroup, groupMembers, groupsLoading]);

  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('👤 User Context State:', {
      profile,
      userLoading,
      hasProfile: !!profile,
      profileId: profile?.id,
      profileUsername: profile?.username
    });
  }, [profile, userLoading]);
  const { showError, showSuccess } = useNotifications();
  
  // FIXED: Get all league functions from useLeagueContext hook
  const {
    fetchLeaderboard,
    setSelectedSeason,
    selectedSeason,
    leaderboard,
    loading: leaderboardLoading
  } = useLeagueContext();

  const numericGroupId = useMemo(
    () => (groupId ? parseInt(groupId, 10) : null),
    [groupId]
  );

  // Local state
  const [activeTab, setActiveTab] = useState('standings');
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  
  // Local loading state to prevent error flash
  const [localLoading, setLocalLoading] = useState(true);
  
  // Prevent duplicate fetches (reset when route groupId changes — see effect below)
  const hasFetchedRef = useRef({});

  // When navigating between groups, clear one-shot flags and season so we refetch standings for the new group.
  useEffect(() => {
    if (!groupId) return;
    hasFetchedRef.current = {};
    setSelectedSeason(null);
    setActiveTab('standings');
  }, [groupId, setSelectedSeason]);

  // Effect: Fetch user profile
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('🎯 Effect: Fetch user profile triggered', { 
      hasProfile: !!profile,
      userLoading,
      profileId: profile?.id 
    });
    
    if (!profile && !userLoading) {
      process.env.NODE_ENV === 'development' && console.log('👤 Fetching user profile...');
      fetchProfile();
    }
  }, [profile, userLoading, fetchProfile]);

  // Effect: Show success message for new groups
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('🎯 Effect: Show success message for new groups', { 
      hasLocationState: !!location.state,
      newGroup: location.state?.newGroup,
      groupName: location.state?.groupName 
    });
    
    if (location.state?.newGroup && location.state?.groupName) {
      showSuccess(`${t('groupDetails.createdSuccessPrefix')} "${location.state.groupName}" ${t('groupDetails.createdSuccessSuffix')}`);
    }
  }, [location.state, showSuccess]);

  // Effect: Load group data
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('🎯 Effect: Load group data triggered', { 
      groupId,
      hasCurrentGroup: !!currentGroup,
      groupsLoading,
      hasFetched: hasFetchedRef.current.groupData
    });
    
    if (groupId && !hasFetchedRef.current.groupData) {
      process.env.NODE_ENV === 'development' && console.log('📊 Loading group data...');
      hasFetchedRef.current.groupData = true;
      loadGroupData();
    }
  }, [groupId, currentGroup, groupsLoading]);

  // Effect: Update local loading state based on context loading
  useEffect(() => {
    if (groupsLoading) {
      setLocalLoading(true);
    } else if (currentGroup || membersError) {
      setLocalLoading(false);
    }
  }, [groupsLoading, currentGroup, membersError]);

  const loadGroupData = async () => {
    try {
      process.env.NODE_ENV === 'development' && console.log('📊 Loading group details and members...');
      const details = await fetchGroupDetails(groupId);
      await fetchGroupMembers(groupId);

      // Load default season + standings immediately after group is known (avoids extra render/wait cycles).
      if (details?.league && Number(details.id) === numericGroupId) {
        setSeasonLoading(true);
        try {
          const season = SeasonManager.getCurrentSeason(details.league);
          hasFetchedRef.current.leaderboard = true;
          setSelectedSeason(season);
          await fetchLeaderboard(details.id, { season });
        } catch (err) {
          process.env.NODE_ENV === 'development' && console.error('❌ Leaderboard load:', err);
          showError(t('groupDetails.loadLeaderboardFailed'));
        } finally {
          setSeasonLoading(false);
        }
      }
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('❌ Error loading group data:', error);
      if (currentGroup) {
        showError(t('groupManagement.failedLoadData'));
      }
    }
  };

  const loadLeaderboard = useCallback(async () => {
    if (!numericGroupId || !selectedSeason) return;
    if (!currentGroup || currentGroup.id !== numericGroupId) return;
    try {
      process.env.NODE_ENV === 'development' && console.log('📊 Loading leaderboard for season:', selectedSeason);
      await fetchLeaderboard(currentGroup.id, { season: selectedSeason });
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('❌ Error loading leaderboard:', error);
      showError(t('groupDetails.loadLeaderboardFailed'));
    }
  }, [numericGroupId, selectedSeason, currentGroup, fetchLeaderboard, showError]);

  // Refetch standings when season changes (SeasonSelector); initial load is handled in loadGroupData.
  useEffect(() => {
    if (!selectedSeason || !currentGroup || currentGroup.id !== numericGroupId) return;
    if (hasFetchedRef.current.leaderboard) return;
    hasFetchedRef.current.leaderboard = true;
    loadLeaderboard();
  }, [selectedSeason, currentGroup, numericGroupId, loadLeaderboard]);

  const handleSeasonChange = (newSeason) => {
    process.env.NODE_ENV === 'development' && console.log('📅 Season changed:', newSeason);
    setSelectedSeason(newSeason);
    hasFetchedRef.current.leaderboard = false;
  };

  // Loading states
  if (userLoading || localLoading) {
    return <LoadingSpinner />;
  }

  // Error states
  if (membersError) {
    return <ErrorMessage message={membersError} />;
  }

  if (!currentGroup) {
    return <ErrorMessage message={t('groupManagement.groupNotFound')} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div data-tour="tour-group-home-header">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {currentGroup.name}
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                {currentGroup.league}
              </span>
              <span>{groupMembers.length} {t('groups.members')}</span>
              {currentGroup.invite_code && (
                <span title={t('groupDetails.shareInviteHelp')}>
                  {t('groupDetails.code')}: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs cursor-help text-gray-900 dark:text-gray-100">{currentGroup.invite_code}</code>
                </span>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3" data-tour="tour-group-home-actions">
            <button
              type="button"
              title={t('groupDetails.tooltipPredictions')}
              onClick={() => navigate(`/groups/${groupId}/predictions`)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
            >
              📊 {t('nav.predictions')}
            </button>
            <button
              type="button"
              title={t('groupDetails.tooltipRivalries')}
              onClick={() => navigate(`/groups/${groupId}/rivalries`)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
            >
              🥊 {t('groupDetails.rivalries')}
            </button>
            {profile?.id === currentGroup.admin_id && (
              <button
                type="button"
                title={t('groupDetails.tooltipManage')}
                onClick={() => navigate(`/groups/${groupId}/manage`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
              >
                ⚙️ {t('groupDetails.manage')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Group Activation Progress */}
      <GroupActivationProgress groupId={parseInt(groupId)} />

      {/* Context-Aware Navigation */}
      <ContextAwareNavigation groupId={parseInt(groupId)} currentPath={location.pathname} />
      <AdSlot placement="groupDetails" />

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6" data-tour="tour-group-tabs">
        <div className="sm:flex sm:space-x-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('standings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'standings'
                  ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('groupDetails.standings')}
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('groupDetails.members')} ({groupMembers.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {activeTab === 'standings' && (
          <div className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <SeasonSelector
                league={currentGroup.league}
                selectedSeason={selectedSeason}
                onSeasonChange={handleSeasonChange}
                disabled={seasonLoading}
                className="w-full sm:w-auto"
              />
            </div>

            {/* Season Display Info */}
            {selectedSeason && currentGroup.league && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {t('groupDetails.showingSeason')} {currentGroup.league}: <strong>{SeasonManager.getSeasonForDisplay(currentGroup.league, selectedSeason)}</strong>
                </p>
              </div>
            )}

            {/* Leaderboard Table */}
            {leaderboardLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('groupDetails.rank')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('groupDetails.player')}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('groupDetails.points')}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('groupDetails.predictions')}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('groupDetails.perfect')}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('groupDetails.accuracy')}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('groupDetails.avgPoints')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {leaderboard && leaderboard.length > 0 ? (
                      leaderboard.map((entry, index) => (
                        <tr 
                          key={entry.user_id} 
                          className={`${
                            entry.username === profile?.username ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          } ${index === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-700`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {entry.rank === 1 && '🏆'} {entry.rank}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {entry.username}
                              {entry.username === profile?.username && (
                                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">({t('common.you')})</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100 font-semibold">
                            {entry.total_points}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                            {entry.total_predictions}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 dark:text-green-400 font-medium">
                            {entry.perfect_predictions}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                            {entry.accuracy_percentage}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-purple-600 dark:text-purple-400">
                            {entry.average_points}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          {selectedSeason ? (
                            <>
                              {t('groupDetails.noPredictionsForSeason')} {SeasonManager.getSeasonForDisplay(currentGroup.league, selectedSeason)}.
                              <br />
                              <span className="text-sm">{t('groupDetails.membersAppearAfterPredictions')}</span>
                            </>
                          ) : (
                            t('groupDetails.loadingSeasonData')
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('groupDetails.groupMembers')} ({groupMembers.length})
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('groupDetails.manageMembersDescription')}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full hidden md:table">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('groupDetails.member')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('groupDetails.role')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('groupDetails.joined')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('groupDetails.status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {groupMembers.map((member) => (
                    <tr key={member.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {member.username}
                          {member.username === profile?.username && (
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">({t('common.you')})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.role === 'ADMIN' 
                            ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' 
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.status === 'APPROVED' 
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile member cards */}
            <div className="md:hidden space-y-3 mt-4">
              {groupMembers.map((member) => (
                <MobileCard key={member.user_id}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {member.username}
                      {member.username === profile?.username && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">({t('common.you')})</span>
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.role === 'ADMIN'
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('groupDetails.joined')} {new Date(member.joined_at).toLocaleDateString()} ·{' '}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        member.status === 'APPROVED'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>
                </MobileCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDetailsPage;