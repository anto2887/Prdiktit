import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentsApi } from '../api';
import { CoinIcon } from '../components/icons/GameIcons';
import { useI18n } from '../i18n';

const WalletPage = () => {
  const { t } = useI18n();
  const [balance, setBalance] = useState(0);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingBundleId, setBuyingBundleId] = useState(null);
  const [error, setError] = useState('');
  const [countryCode, setCountryCode] = useState(null);

  const normalizeList = (response) => {
    const payload = response?.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    return [];
  };
  const normalizeWallet = (response) =>
    response?.data?.balance_coins ??
    response?.data?.data?.balance_coins ??
    0;

  const detectCountryCode = () => {
    if (typeof navigator === 'undefined') return null;
    const locale = navigator.language || '';
    const parts = locale.split('-');
    if (parts.length < 2) return null;
    const code = (parts[1] || '').toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  };

  const loadWalletData = async () => {
    try {
      setLoading(true);
      setError('');
      const detected = detectCountryCode();
      setCountryCode(detected);
      const [walletRes, bundlesRes] = await Promise.all([
        paymentsApi.getWallet(),
        paymentsApi.getCoinBundles(detected),
      ]);
      setBalance(normalizeWallet(walletRes));
      setBundles(normalizeList(bundlesRes));
    } catch (e) {
      setError(e?.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const onBuyBundle = async (bundle) => {
    try {
      setBuyingBundleId(bundle.bundle_id);
      setError('');
      const response = await paymentsApi.createCheckoutSession(bundle.bundle_id, countryCode);
      const url = response?.data?.url || response?.data?.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error('Checkout URL not returned');
    } catch (e) {
      setError(e?.message || 'Unable to start checkout');
    } finally {
      setBuyingBundleId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('wallet.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {t('wallet.subtitle')}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          {t('wallet.powerupCtaPrefix')}{' '}
          <Link to="/powerups" className="text-blue-600 dark:text-blue-400 hover:underline">
            {t('nav.powerups')}
          </Link>
          .
        </p>
      </div>

      <div
        className="bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/30 dark:to-gray-800 rounded-xl border border-amber-200/80 dark:border-amber-800/50 p-6 shadow-sm"
        data-tour="tour-wallet-balance"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          <CoinIcon className="w-5 h-5" title={t('powerups.coins')} />
          {t('wallet.balance')}
        </div>
        <div className="flex items-baseline gap-3 mt-3">
          <div className="rounded-2xl bg-white/80 dark:bg-gray-900/60 p-3 ring-1 ring-amber-200/60 dark:ring-amber-700/50 shadow-inner">
            <CoinIcon className="w-10 h-10" title={t('powerups.coins')} />
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{balance}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('powerups.coins')}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
        data-tour="tour-wallet-bundles"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('wallet.coinBundles')}</h2>
        {loading ? (
          <div className="text-gray-500 dark:text-gray-300 text-sm">{t('wallet.loadingBundles')}</div>
        ) : bundles.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-300 text-sm">
            {t('wallet.noBundles')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((bundle) => (
              <div
                key={`${bundle.bundle_id}-${bundle.tier || 'default'}`}
                className="border border-gray-200 dark:border-gray-600 rounded-xl p-5 bg-white dark:bg-gray-800/50 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/50 ring-1 ring-amber-200/70 dark:ring-amber-800/50">
                    <CoinIcon className="w-9 h-9" title={t('powerups.coins')} />
                  </div>
                  <div>
                    <div className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                      {bundle.coins}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('powerups.coins')}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  Tier: {bundle.tier || 'default'} · {(bundle.currency || 'usd').toUpperCase()}
                </div>
                <button
                  onClick={() => onBuyBundle(bundle)}
                  disabled={buyingBundleId === bundle.bundle_id}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  <CoinIcon className="w-4 h-4 opacity-90" />
                  {buyingBundleId === bundle.bundle_id ? t('wallet.startingCheckout') : t('wallet.buy')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
