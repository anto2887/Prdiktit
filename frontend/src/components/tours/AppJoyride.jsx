import React, { useCallback } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { useTour } from '../../contexts/TourContext';
import { useI18n } from '../../i18n';

const joyrideStyles = {
  options: {
    zIndex: 10050,
    arrowColor: '#fff',
    backgroundColor: '#fff',
    overlayColor: 'rgba(15, 23, 42, 0.72)',
    primaryColor: '#2563eb',
    textColor: '#1f2937',
  },
  tooltip: {
    borderRadius: 12,
    padding: 16,
  },
  tooltipContainer: {
    textAlign: 'left',
  },
  buttonNext: {
    borderRadius: 8,
    fontSize: 14,
  },
  buttonBack: {
    color: '#64748b',
    marginRight: 8,
  },
  buttonSkip: {
    color: '#64748b',
  },
};

const joyrideStylesDark = {
  options: {
    zIndex: 10050,
    arrowColor: '#1e293b',
    backgroundColor: '#1e293b',
    overlayColor: 'rgba(0, 0, 0, 0.75)',
    primaryColor: '#3b82f6',
    textColor: '#f1f5f9',
  },
  tooltip: {
    borderRadius: 12,
    padding: 16,
  },
  tooltipTitle: {
    color: '#f8fafc',
  },
  tooltipContent: {
    color: '#e2e8f0',
  },
  buttonNext: {
    borderRadius: 8,
    fontSize: 14,
  },
  buttonBack: {
    color: '#94a3b8',
    marginRight: 8,
  },
  buttonSkip: {
    color: '#94a3b8',
  },
};

const AppJoyride = () => {
  const { t } = useI18n();
  const { run, steps, joyrideKey, stopTour } = useTour();

  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const handleCallback = useCallback(
    (data) => {
      const { status } = data;
      if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
        stopTour();
      }
    },
    [stopTour]
  );

  if (!steps.length) {
    return null;
  }

  return (
    <Joyride
      key={joyrideKey}
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrolling={false}
      spotlightClicks={false}
      callback={handleCallback}
      styles={isDark ? joyrideStylesDark : joyrideStyles}
      locale={{
        back: t('common.back'),
        close: t('common.close'),
        last: t('common.finish'),
        next: t('common.next'),
        skip: t('help.skipTour'),
      }}
    />
  );
};

export default AppJoyride;
