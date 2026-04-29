import React, { useEffect, useState } from 'react';
import { paymentsApi } from '../api';

const WalletPage = () => {
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Buy coins and use them for power-ups.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-sm text-gray-500 dark:text-gray-300">Current Balance</div>
        <div className="text-3xl font-semibold text-blue-600 dark:text-blue-400 mt-2">
          {balance} coins
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Coin bundles</h2>
        {loading ? (
          <div className="text-gray-500 dark:text-gray-300 text-sm">Loading bundles...</div>
        ) : bundles.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-300 text-sm">
            No bundles are currently available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((bundle) => (
              <div
                key={`${bundle.bundle_id}-${bundle.tier || 'default'}`}
                className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
              >
                <div className="text-base font-medium text-gray-900 dark:text-white">
                  {bundle.coins} coins
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                  Tier: {bundle.tier || 'default'} | Currency: {(bundle.currency || 'usd').toUpperCase()}
                </div>
                <button
                  onClick={() => onBuyBundle(bundle)}
                  disabled={buyingBundleId === bundle.bundle_id}
                  className="mt-4 w-full px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {buyingBundleId === bundle.bundle_id ? 'Starting checkout...' : 'Buy'}
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
