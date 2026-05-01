import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi, paymentsApi, powerupsApi } from '../api';
import { CoinIcon, PowerupTypeIcon, powerupAccentBg } from '../components/icons/GameIcons';
import { useGroups } from '../contexts/AppContext';
import { useI18n } from '../i18n';

const PowerUpsPage = () => {
  const { t } = useI18n();
  const { currentGroup } = useGroups();
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState({});
  const [members, setMembers] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState({});
  const [buyingType, setBuyingType] = useState('');
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

  const normalizeWallet = (response) =>
    response?.data?.balance_coins ??
    response?.data?.data?.balance_coins ??
    0;

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

  const selectedInventoryCount = selectedPowerup
    ? inventory[selectedPowerup.powerup_type] || 0
    : 0;
  const selectedTargetInSourceGroup = useMemo(() => {
    if (powerupType !== 'FREEZE' || !targetUserId) return true;
    return members.some((member) => String(member.user_id) === String(targetUserId));
  }, [members, powerupType, targetUserId]);
  const requiredInventoryUnits =
    powerupType === 'FREEZE' && targetUserId && !selectedTargetInSourceGroup ? 2 : 1;

  const refreshPowerupData = async () => {
    const [catalogRes, membersRes, inventoryRes, walletRes] = await Promise.all([
      powerupsApi.getCatalog(),
      sourceGroupId ? groupsApi.getGroupMembers(sourceGroupId) : Promise.resolve({ data: [] }),
      powerupsApi.getInventory(),
      paymentsApi.getWallet(),
    ]);

    const catalogRows = asArray(catalogRes?.data);
    setCatalog(catalogRows);
    setMembers(asArray(membersRes?.data));
    setWalletBalance(normalizeWallet(walletRes));

    const inventoryRows = asArray(inventoryRes?.data);
    const inventoryMap = {};
    inventoryRows.forEach((row) => {
      const type = row?.powerup_type;
      if (type) inventoryMap[type] = row?.quantity || 0;
    });
    setInventory(inventoryMap);

    // Seed purchase quantity controls for new rows.
    setPurchaseQuantity((prev) => {
      const next = { ...prev };
      catalogRows.forEach((row) => {
        if (!next[row.powerup_type]) {
          next[row.powerup_type] = 1;
        }
      });
      return next;
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        await refreshPowerupData();
      } catch (e) {
        setError(e?.message || t('powerups.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sourceGroupId, t]);

  useEffect(() => {
    if (!effectiveUtcDate) {
      setEffectiveUtcDate(new Date().toISOString().slice(0, 10));
    }
  }, [effectiveUtcDate]);

  const onPurchase = async (type, quickQuantity = null) => {
    try {
      const qty = quickQuantity || purchaseQuantity[type] || 1;
      setBuyingType(type);
      setError('');
      setResult(null);
      await powerupsApi.purchase({
        powerup_type: type,
        quantity: Number(qty),
      });
      await refreshPowerupData();
      setResult({
        kind: 'purchase',
        powerup_type: type,
        quantity: Number(qty),
      });
    } catch (e) {
      setError(e?.message || t('powerups.purchaseFailed'));
    } finally {
      setBuyingType('');
    }
  };

  const onActivate = async (event) => {
    event.preventDefault();
    if (!sourceGroupId) {
      setError(t('powerups.selectGroupFirst'));
      return;
    }
    if (selectedInventoryCount < requiredInventoryUnits) {
      setError(
        requiredInventoryUnits > 1
          ? t('powerups.noInventoryForOutOfGroupFreeze')
          : t('powerups.noInventoryToActivate')
      );
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
      const activationResult = response?.data?.data || response?.data || response;
      setResult({
        kind: 'activate',
        ...(activationResult || {}),
      });
      await refreshPowerupData();
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
          {t('powerups.subtitleV2')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('powerups.walletBalance')}</div>
          <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
            <CoinIcon className="w-6 h-6" />
            {walletBalance}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('powerups.walletHint')}</p>
        </div>
        <div
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 lg:col-span-2"
          data-tour="tour-powerups-inventory"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('powerups.inventoryOverview')}</div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['SHIELD', 'FREEZE', 'MULTIPLIER'].map((type) => (
              <div key={type} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center gap-2">
                  <PowerupTypeIcon type={type} className="w-5 h-5" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {getPowerupLabel(type, type)}
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {inventory[type] || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('powerups.owned')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-300">{t('powerups.loadingCatalog')}</div>
      ) : (
        <div className="space-y-3" data-tour="tour-powerups-buy">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('powerups.buyPowerups')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('powerups.buyHelp')}{' '}
            <Link to="/wallet" className="text-blue-600 dark:text-blue-400 hover:underline">
              {t('wallet.title')}
            </Link>
            .
          </p>
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
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                {t('powerups.owned')}: <span className="font-semibold">{inventory[item.powerup_type] || 0}</span>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="number"
                  min={1}
                  value={purchaseQuantity[item.powerup_type] || 1}
                  onChange={(e) =>
                    setPurchaseQuantity((prev) => ({
                      ...prev,
                      [item.powerup_type]: Math.max(1, Number(e.target.value || 1)),
                    }))
                  }
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => onPurchase(item.powerup_type)}
                  disabled={buyingType === item.powerup_type}
                  className="rounded-md bg-blue-600 text-white text-sm px-3 py-1.5 hover:bg-blue-700 disabled:opacity-60"
                >
                  {buyingType === item.powerup_type ? t('powerups.buying') : t('powerups.buyNow')}
                </button>
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      <form
        onSubmit={onActivate}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4"
        data-tour="tour-powerups-activate"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('powerups.activatePowerup')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('powerups.activateHelp')}</p>
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
            <CoinIcon className="w-5 h-5 flex-shrink-0" />
            <span>
              {t('powerups.baseCost')}:{' '}
              <span className="font-medium tabular-nums">
                {selectedPowerup.base_cost_coins} {t('powerups.coins')}
              </span>
            </span>
            <span>
              {t('powerups.owned')}:{' '}
              <span className={`font-medium ${selectedInventoryCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {selectedInventoryCount}
              </span>
            </span>
            <span>
              {t('powerups.inventoryRequired')}:{' '}
              <span className={`font-medium ${selectedInventoryCount >= requiredInventoryUnits ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {requiredInventoryUnits}
              </span>
            </span>
            {powerupType === 'FREEZE' && targetUserId && !selectedTargetInSourceGroup && (
              <span className="text-amber-700 dark:text-amber-300">
                {t('powerups.outOfGroupFreezeCostsTwo')}
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {result?.kind === 'purchase' && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3 text-sm text-green-700 dark:text-green-300">
            {t('powerups.purchaseComplete')}: {result.quantity}x {getPowerupLabel(result.powerup_type)}.
          </div>
        )}

        {result?.kind === 'activate' && (
          <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3 text-sm text-green-700 dark:text-green-300">
            <CoinIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              {t('powerups.activationComplete')}{' '}
              {result.inventory_consumed != null && (
                <>
                  {t('powerups.inventoryConsumed')}: {result.inventory_consumed}.{' '}
                </>
              )}
              {result.inventory_after != null && (
                <>
                  {t('powerups.remaining')}: {result.inventory_after}.
                </>
              )}
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !sourceGroupId || selectedInventoryCount < requiredInventoryUnits}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? t('powerups.activating') : t('powerups.activate')}
        </button>
      </form>
    </div>
  );
};

export default PowerUpsPage;
