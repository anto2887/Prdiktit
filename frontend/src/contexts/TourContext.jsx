import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import {
  filterReachableSteps,
  getTourBuilder,
  resolvePageTourKey,
  toJoyrideSteps,
} from '../tours/tourSteps';

const STORAGE_PENDING = 'prdiktit_pending_tour';

const TourContext = createContext({
  startTour: () => {},
  startTourAfterNavigation: () => {},
  stopTour: () => {},
  run: false,
});

export const TourProvider = ({ children }) => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState([]);
  const [joyrideKey, setJoyrideKey] = useState(0);
  const startedRef = useRef(false);

  const stopTour = useCallback(() => {
    setRun(false);
    setSteps([]);
    startedRef.current = false;
  }, []);

  const startTour = useCallback(
    (tourKey) => {
      const builder = getTourBuilder(tourKey);
      if (!builder) return false;
      const raw = builder();
      const joy = toJoyrideSteps(raw, t);
      const filtered = filterReachableSteps(joy);
      if (filtered.length === 0) return false;
      setSteps(filtered);
      setJoyrideKey((k) => k + 1);
      setRun(true);
      startedRef.current = true;
      return true;
    },
    [t]
  );

  const startTourAfterNavigation = useCallback(
    (tourKey, path) => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(STORAGE_PENDING, tourKey);
      }
      navigate(path);
    },
    [navigate]
  );

  // Resume tour after redirect (e.g. dashboard tour from another page)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pending = window.sessionStorage.getItem(STORAGE_PENDING);
    if (!pending) return;

    const builder = getTourBuilder(pending);
    window.sessionStorage.removeItem(STORAGE_PENDING);
    if (!builder) return;

    const tryStart = () => {
      const raw = builder();
      const joy = toJoyrideSteps(raw, t);
      const filtered = filterReachableSteps(joy);
      if (filtered.length === 0) return;
      setSteps(filtered);
      setJoyrideKey((k) => k + 1);
      setRun(true);
    };

    const id = window.setTimeout(tryStart, 400);
    return () => window.clearTimeout(id);
  }, [location.pathname, t]);

  const value = useMemo(
    () => ({
      startTour,
      startTourAfterNavigation,
      stopTour,
      run,
      steps,
      joyrideKey,
    }),
    [startTour, startTourAfterNavigation, stopTour, run, steps, joyrideKey]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

export const useTour = () => useContext(TourContext);

export { resolvePageTourKey };
