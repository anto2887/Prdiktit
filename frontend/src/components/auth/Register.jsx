import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import OAuthLogin from './OAuthLogin';
import { useI18n } from '../../i18n';
import { REFERRER_USERNAME_STORAGE_KEY } from '../../constants/referral';

export const Register = () => {
  const { t } = useI18n();
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('ref');
      if (r && r.trim()) {
        sessionStorage.setItem(REFERRER_USERNAME_STORAGE_KEY, r.trim());
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img 
          src="/static/images/logo.svg" 
          alt="Logo" 
          className="mx-auto h-12 w-auto"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          {t('auth.createAccount')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('auth.joinWithGoogle')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center mb-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('auth.registerGoogleOnly')}
            </p>
          </div>

          <OAuthLogin 
            disabled={!acceptedTerms}
            disabledReason={t('auth.acceptTermsToContinue')}
            onSuccess={(data) => {
              // OAuth success is handled by OAuthCallbackPage
              // No need to store JWT tokens - using session-based auth
              // Redirect to dashboard after successful registration
              window.location.href = '/dashboard';
            }}
            onError={(error) => {
              console.error('OAuth registration error:', error);
            }}
          />

          <div className="mt-5">
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                {t('auth.confirmOver18AndAgree')}{' '}
                <Link to="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                  {t('legal.termsTitle')}
                </Link>{' '}
                {t('common.and')}{' '}
                <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                  {t('legal.privacyTitle')}
                </Link>
                .
              </span>
            </label>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link 
                to="/login" 
                className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
              >
                {t('auth.signInHere')}
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">{t('auth.whyGoogle')}</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• {t('auth.whyGoogle1')}</li>
              <li>• {t('auth.whyGoogle2')}</li>
              <li>• {t('auth.whyGoogle3')}</li>
              <li>• {t('auth.whyGoogle4')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;