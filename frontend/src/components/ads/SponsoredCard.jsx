import React from 'react';
import { useI18n } from '../../i18n';

const SponsoredCard = ({ title, body, cta, href = '#' }) => {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
        {t('ads.sponsored')}
      </div>
      <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{body}</p>
      <a
        href={href}
        className="inline-flex mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        {cta || t('ads.learnMore')}
      </a>
    </div>
  );
};

export default SponsoredCard;
