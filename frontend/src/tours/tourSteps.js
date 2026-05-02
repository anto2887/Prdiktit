/**
 * Guided tour step definitions. All copy uses i18n keys via the passed `t` function.
 * Targets use [data-tour="..."] selectors rendered in layout and pages.
 */

export function resolvePageTourKey(pathname) {
  if (pathname === '/dashboard') return 'dashboard';
  if (pathname === '/wallet') return 'wallet';
  if (pathname === '/powerups') return 'powerups';
  if (pathname === '/worldcup/leaderboard') return 'globalPot';
  if (pathname === '/predictions' || pathname.startsWith('/predictions/')) return 'predictions';
  const m = pathname.match(/^\/groups\/(\d+)\/predictions\/?$/);
  if (m) return 'groupPredictions';
  const r = pathname.match(/^\/groups\/(\d+)\/rivalries\/?$/);
  if (r) return 'rivalries';
  const g = pathname.match(/^\/groups\/(\d+)\/?$/);
  if (g) return 'groupHome';
  if (pathname === '/groups/create') return 'createGroup';
  return null;
}

/** Remove steps whose target element is not in the DOM or is display:none (e.g. hidden sidebar on mobile). */
export function filterReachableSteps(steps) {
  return steps.filter((step) => {
    const target = step.target;
    if (!target || target === 'body') return true;
    const el = document.querySelector(target);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) return false;
    return true;
  });
}

function step(target, titleKey, contentKey, placement = 'bottom') {
  return { target, titleKey, contentKey, placement };
}

export function buildDashboardTourSteps() {
  return [
    step('body', 'tour.dashboard.welcomeTitle', 'tour.dashboard.welcomeBody', 'center'),
    step('[data-tour="tour-sidebar-root"]', 'tour.dashboard.sidebarTitle', 'tour.dashboard.sidebarBody', 'right-start'),
    step('[data-tour="tour-nav-dashboard"]', 'tour.dashboard.navDashboardTitle', 'tour.dashboard.navDashboardBody', 'right'),
    step('[data-tour="tour-nav-predictions"]', 'tour.dashboard.navPredictionsTitle', 'tour.dashboard.navPredictionsBody', 'right'),
    step('[data-tour="tour-nav-wallet"]', 'tour.dashboard.navWalletTitle', 'tour.dashboard.navWalletBody', 'right'),
    step('[data-tour="tour-nav-powerups"]', 'tour.dashboard.navPowerupsTitle', 'tour.dashboard.navPowerupsBody', 'right'),
    step('[data-tour="tour-nav-global-pot"]', 'tour.dashboard.navGlobalPotTitle', 'tour.dashboard.navGlobalPotBody', 'right'),
    step('[data-tour="tour-sidebar-groups"]', 'tour.dashboard.groupsNavTitle', 'tour.dashboard.groupsNavBody', 'right'),
    step('[data-tour="tour-dashboard-stats"]', 'tour.dashboard.statsTitle', 'tour.dashboard.statsBody', 'bottom'),
    step('[data-tour="tour-dashboard-upcoming"]', 'tour.dashboard.upcomingTitle', 'tour.dashboard.upcomingBody', 'top'),
    step('[data-tour="tour-dashboard-recent"]', 'tour.dashboard.recentTitle', 'tour.dashboard.recentBody', 'top'),
    step('[data-tour="tour-dashboard-groups"]', 'tour.dashboard.leaguesTitle', 'tour.dashboard.leaguesBody', 'top'),
    step('[data-tour="tour-mobile-nav-root"]', 'tour.dashboard.mobileNavTitle', 'tour.dashboard.mobileNavBody', 'top'),
    step('[data-tour="tour-mobile-nav-home"]', 'tour.dashboard.mobileHomeTitle', 'tour.dashboard.mobileHomeBody', 'top'),
    step('[data-tour="tour-mobile-nav-groups"]', 'tour.dashboard.mobileGroupsTitle', 'tour.dashboard.mobileGroupsBody', 'top'),
    step('[data-tour="tour-mobile-nav-predict"]', 'tour.dashboard.mobilePredictTitle', 'tour.dashboard.mobilePredictBody', 'top'),
    step('[data-tour="tour-mobile-nav-wallet"]', 'tour.dashboard.mobileWalletTitle', 'tour.dashboard.mobileWalletBody', 'top'),
    step('[data-tour="tour-mobile-nav-profile"]', 'tour.dashboard.mobileProfileTitle', 'tour.dashboard.mobileProfileBody', 'top'),
  ];
}

export function buildWalletTourSteps() {
  return [
    step('body', 'tour.wallet.introTitle', 'tour.wallet.introBody', 'center'),
    step('[data-tour="tour-wallet-balance"]', 'tour.wallet.balanceTitle', 'tour.wallet.balanceBody', 'bottom'),
    step('[data-tour="tour-wallet-bundles"]', 'tour.wallet.bundlesTitle', 'tour.wallet.bundlesBody', 'top'),
  ];
}

export function buildPowerupsTourSteps() {
  return [
    step('body', 'tour.powerups.introTitle', 'tour.powerups.introBody', 'center'),
    step('[data-tour="tour-powerups-inventory"]', 'tour.powerups.inventoryTitle', 'tour.powerups.inventoryBody', 'bottom'),
    step('[data-tour="tour-powerups-buy"]', 'tour.powerups.buyTitle', 'tour.powerups.buyBody', 'top'),
    step('[data-tour="tour-powerups-catalog"]', 'tour.powerups.catalogTitle', 'tour.powerups.catalogBody', 'top'),
    step('[data-tour="tour-powerups-activate"]', 'tour.powerups.activateTitle', 'tour.powerups.activateBody', 'top'),
    step('[data-tour="tour-powerups-activate"]', 'tour.powerups.howToUseTitle', 'tour.powerups.howToUseBody', 'top'),
    step('[data-tour="tour-powerups-activate"]', 'tour.powerups.rulesTitle', 'tour.powerups.rulesBody', 'top'),
  ];
}

export function buildGlobalPotTourSteps() {
  return [
    step('body', 'tour.globalPot.introTitle', 'tour.globalPot.introBody', 'center'),
    step('[data-tour="tour-global-pot-header"]', 'tour.globalPot.headerTitle', 'tour.globalPot.headerBody', 'bottom'),
    step('[data-tour="tour-global-pot-table"]', 'tour.globalPot.tableTitle', 'tour.globalPot.tableBody', 'top'),
  ];
}

export function buildPredictionsTourSteps() {
  return [
    step('body', 'tour.predictions.introTitle', 'tour.predictions.introBody', 'center'),
    step('[data-tour="tour-predictions-page"]', 'tour.predictions.listTitle', 'tour.predictions.listBody', 'bottom'),
  ];
}

export function buildGroupHomeTourSteps() {
  return [
    step('body', 'tour.groupHome.introTitle', 'tour.groupHome.introBody', 'center'),
    step('[data-tour="tour-group-home-header"]', 'tour.groupHome.headerTitle', 'tour.groupHome.headerBody', 'bottom'),
    step('[data-tour="tour-group-home-actions"]', 'tour.groupHome.actionsTitle', 'tour.groupHome.actionsBody', 'bottom'),
    step('[data-tour="tour-group-tabs"]', 'tour.groupHome.tabsTitle', 'tour.groupHome.tabsBody', 'bottom'),
  ];
}

export function buildGroupPredictionsTourSteps() {
  return [
    step('body', 'tour.groupPredictions.introTitle', 'tour.groupPredictions.introBody', 'center'),
    step('[data-tour="tour-group-predictions-controls"]', 'tour.groupPredictions.controlsTitle', 'tour.groupPredictions.controlsBody', 'bottom'),
    step('[data-tour="tour-group-predictions-main"]', 'tour.groupPredictions.mainTitle', 'tour.groupPredictions.mainBody', 'top'),
  ];
}

export function buildRivalriesTourSteps() {
  return [
    step('body', 'tour.rivalries.introTitle', 'tour.rivalries.introBody', 'center'),
    step('[data-tour="tour-rivalry-header"]', 'tour.rivalries.headerTitle', 'tour.rivalries.headerBody', 'bottom'),
    step('[data-tour="tour-rivalry-tabs"]', 'tour.rivalries.tabsTitle', 'tour.rivalries.tabsBody', 'bottom'),
  ];
}

export function buildCreateGroupTourSteps() {
  return [
    step('body', 'tour.createGroup.introTitle', 'tour.createGroup.introBody', 'center'),
    step('[data-tour="tour-create-group-page-header"]', 'tour.createGroup.pageHeaderTitle', 'tour.createGroup.pageHeaderBody', 'bottom'),
    step('[data-tour="tour-create-group-progress"]', 'tour.createGroup.progressTitle', 'tour.createGroup.progressBody', 'bottom'),
    step('[data-tour="tour-create-group-active-step"]', 'tour.createGroup.activeStepTitle', 'tour.createGroup.activeStepBody', 'top'),
  ];
}

const BUILDERS = {
  dashboard: buildDashboardTourSteps,
  wallet: buildWalletTourSteps,
  powerups: buildPowerupsTourSteps,
  globalPot: buildGlobalPotTourSteps,
  predictions: buildPredictionsTourSteps,
  groupHome: buildGroupHomeTourSteps,
  groupPredictions: buildGroupPredictionsTourSteps,
  rivalries: buildRivalriesTourSteps,
  createGroup: buildCreateGroupTourSteps,
};

export function getTourBuilder(tourKey) {
  return BUILDERS[tourKey] || null;
}

/** Convert our step defs to react-joyride steps with translated strings. */
export function toJoyrideSteps(rawSteps, t) {
  return rawSteps.map((s) => ({
    target: s.target,
    title: t(s.titleKey),
    content: t(s.contentKey),
    placement: s.placement,
    disableBeacon: true,
  }));
}
