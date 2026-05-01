import React, { useEffect, useMemo, useState } from 'react';
import { groupsApi, powerupsApi } from '../api';
import { CoinIcon, PowerupTypeIcon, powerupAccentBg } from '../components/icons/GameIcons';
import { useGroups } from '../contexts/AppContext';
import { useI18n } from '../i18n';

const PowerUpsPage = () => {
  const { t } = useI18n();
  const { currentGroup } = useGroups();
  const [catalog, setCatalog] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [powerupType, setPowerupType] = useState('SHIELD');
  const [effectiveUtcDate, setEffectiveUtcDate] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [fixtureId, setFixtureId] = useState('');

  const sourceGroupId = currentGroup?.id || '';
  const asArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const selectedPowerup = useMemo(
    () => catalog.find((item) => item.powerup_type === powerupType),
    [catalog, powerupType]
  );
  const getPowerupLabel = (type, fallbackName = '') => {
    if (type === 'SHIELD') return t('powerups.shield');
    if (type === 'FREEZE') return t('powerups.freeze');
    if (type === 'MULTIPLIER') return t('powerups.multiplier');
    return fallbackName || type;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [catalogRes, membersRes] = await Promise.all([
          powerupsApi.getCatalog(),
          sourceGroupId ? groupsApi.getGroupMembers(sourceGroupId) : Promise.resolve({ data: [] }),
        ]);
        setCatalog(asArray(catalogRes?.data));
        setMembers(asArray(membersRes?.data));
      } catch (e) {
        setError(e?.message || t('powerups.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sourceGroupId]);

  useEffect(() => {
    if (!effectiveUtcDate) {
      setEffectiveUtcDate(new Date().toISOString().slice(0, 10));
    }
  }, [effectiveUtcDate]);

  const onActivate = async (event) => {
    event.preventDefault();
    if (!sourceGroupId) {
      setError(t('powerups.selectGroupFirst'));
      return;
    }

    const payload = {
      powerup_type: powerupType,
      source_group_id: Number(sourceGroupId),
      effective_utc_date: effectiveUtcDate,
    };

    if (powerupType === 'FREEZE' && targetUserId) {
      payload.target_user_id = Number(targetUserId);
    }
    if (powerupType === 'MULTIPLIER' && fixtureId) {
      payload.fixture_id = Number(fixtureId);
    }

    try {
      setSubmitting(true);
      setError('');
      setResult(null);
      const response = await powerupsApi.activate(payload);
      setResult(response?.data || response?.data?.data || response);
    } catch (e) {
      setError(e?.message || t('powerups.activationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('powerups.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {t('powerups.subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-300">{t('powerups.loadingCatalog')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-tour="tour-powerups-catalog">
          {catalog.map((item) => (
            <div
              key={item.powerup_type}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className={`inline-flex items-center justify-center rounded-2xl p-4 mb-4 ring-1 ${powerupAccentBg(item.powerup_type)}`}
              >
                <PowerupTypeIcon type={item.powerup_type} className="w-14 h-14" title={getPowerupLabel(item.powerup_type, item.display_name)} />
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.powerup_type}</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">
                {getPowerupLabel(item.powerup_type, item.display_name)}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 mt-3">
                <CoinIcon className="w-5 h-5" title={t('powerups.coins')} />
                <span>
                  <span className="font-semibold tabular-nums">{item.base_cost_coins}</span> {t('powerups.coins')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={onActivate}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4"
        data-tour="tour-powerups-activate"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('powerups.activatePowerup')}</h2>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {t('powerups.sourceGroup')}: {sourceGroupId || t('powerups.noCurrentGroupSelected')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="flex items-center gap-2 mb-1 text-gray-700 dark:text-gray-200">
              {selectedPowerup && (
                <span className="inline-flex rounded-lg p-1 ring-1 ring-gray-200 dark:ring-gray-600 bg-gray-50 dark:bg-gray-900/80">
                  <PowerupTypeIcon type={selectedPowerup.powerup_type} className="w-6 h-6" />
                </span>
              )}
              {t('powerups.powerup')}
            </span>
            <select
              value={powerupType}
              onChange={(e) => setPowerupType(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
            >
              {catalog.map((item) => (
                <option key={item.powerup_type} value={item.powerup_type}>
                  {getPowerupLabel(item.powerup_type, item.display_name)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700 dark:text-gray-200">{t('powerups.effectiveUtcDate')}</span>
            <input
              type="date"
              value={effectiveUtcDate}
              onChange={(e) => setEffectiveUtcDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              required
            />
          </label>

          {powerupType === 'FREEZE' && (
            <label className="text-sm md:col-span-2">
              <span className="block mb-1 text-gray-700 dark:text-gray-200">{t('powerups.targetUser')}</span>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                required
              >
                <option value="">{t('powerups.selectTargetUser')}</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.username}
                  </option>
                ))}
              </select>
            </label>
          )}

          {powerupType === 'MULTIPLIER' && (
            <label className="text-sm md:col-span-2">
              <span className="block mb-1 text-gray-700 dark:text-gray-200">{t('powerups.fixtureId')}</span>
              <input
                type="number"
                value={fixtureId}
                onChange={(e) => setFixtureId(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                required
              />
            </label>
          )}
        </div>

        {selectedPowerup && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <CoinIcon className="w-5 h-5 flex-shrink-0" />
            <span>
              {t('powerups.baseCost')}:{' '}
              <span className="font-medium tabular-nums">
                {selectedPowerup.base_cost_coins} {t('powerups.coins')}
              </span>
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3 text-sm text-green-700 dark:text-green-300">
            <CoinIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              {t('powerups.activationCompleteCharged')}: {result.charged_cost_coins ?? result?.data?.charged_cost_coins}{' '}
              {t('powerups.coins')}.
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !sourceGroupId}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? t('powerups.activating') : t('powerups.activate')}
        </button>
      </form>
    </div>
  );
};

export default PowerUpsPage;
