# World Cup 2026 Launch Plan (Execution Tracker)

Owner: Prdiktit core team  
Plan status: Locked baseline  
Target go-live deadline: 2026-05-02

---

## 1) Locked scope and rules

### Scope A (launch by 2026-05-02)
- Coins wallet + ledger
- Stripe fixed-bundle purchases
- Power-ups (freeze, shield, multiplier)
- Global pot with canonical single-entry model
- Sponsor/native ads on high-volume pages
- i18n: English, Spanish, French (primary UX + legal pages)
- Terms acceptance gate for new users

### Scope B (post-launch)
- Goalscorer and assists feature set

### Core rule lock
- UTC calendar date is canonical day key.
- Freeze: target daily gain = 0.
- Shield: one UTC day, nullifies freeze.
- Multiplier: 2x only, one fixture per user per UTC day.
- No stacking across all power-ups.
- Duplicate same-day usage may charge but does not increase effect.
- Targeted power-ups require `source_group_id`.
- Outside source group targeting = 2x pricing.
- Cost order: shield > freeze > multiplier.

### Canonical global pot lock
- One canonical entry per user.
- Canonical source = user's best-performing group.
- Lock point = after Matchday 2 fully processed.
- Tie-break includes rivalry wins.

### Rivalry-day calendar
- 2026-06-14
- 2026-06-17
- 2026-06-20
- 2026-06-23
- 2026-06-27
- 2026-06-30
- 2026-07-03
- 2026-07-07
- 2026-07-11
- 2026-07-19

### Compliance lock
- 18+ minimum age.
- No refunds for coins/power-ups.
- Payout via PayPal after government ID verification.
- New users must accept Terms and Conditions before access.

---

## 2) External accounts and operations setup

### Stripe
- [ ] Create/verify Stripe account
- [ ] Enable test and live modes
- [ ] Define fixed bundle products/prices
- [ ] Configure webhook endpoint
- [ ] Store webhook signing secret securely
- [ ] Store API keys in Railway environment

### PayPal payout operations
- [ ] Verify PayPal business payout account
- [ ] Draft payout operations checklist
- [ ] Draft verification workflow (ID verification before payout)

### Legal operational metadata
- [ ] Confirm support/legal contact email
- [ ] Confirm jurisdictions/restrictions text

---

## 3) Day-by-day tracker (start 2026-04-24)

## Day 1 - Rules, legal draft, setup
- [x] Lock gameplay rules and launch scope
- [x] Record canonical lock and rivalry schedule rules
- [x] Record legal policy requirements
- [x] Add persistent launch tracking doc
- [ ] Stripe/PayPal account setup completed in test mode
- [x] Terms/Privacy full draft completed for review
- [x] Frontend legal acceptance gate added to registration/OAuth completion flow
- [x] Backend legal acceptance validation + acceptance metadata storage added for OAuth completion

Acceptance:
- [ ] No unresolved product-rule ambiguity
- [ ] External setup status documented

## Day 2 - DB and migration plan
- [x] Define wallet/ledger schema
- [x] Define power-up catalog/activation schema
- [x] Define canonical-entry + lock metadata schema
- [x] Define non-stacking DB constraints
- [ ] Create migration + rollback notes

Acceptance:
- [x] Schema supports all locked rules

## Day 3 - Payments backend foundation
- [ ] Implement Stripe checkout session creation
- [ ] Implement webhook signature validation
- [ ] Implement idempotent payment processing
- [ ] Credit wallet through immutable ledger

Acceptance:
- [ ] Test payment credits exactly once

## Day 4 - Power-up purchase/activation engine
- [ ] Enforce source_group_id on targeted usage
- [ ] Enforce 2x outside-group pricing
- [ ] Enforce no-stacking constraints
- [ ] Enforce multiplier one fixture/day rule
- [ ] Enforce duplicate-charge behavior

Acceptance:
- [ ] Activation API passes edge-case matrix

## Day 5 - Scoring integration
- [ ] Integrate power-up effects into scoring path
- [ ] Ensure consistent behavior across all processing paths
- [ ] Verify UTC day-bound behavior

Acceptance:
- [ ] Correct points under freeze/shield/multiplier rules

## Day 6 - Global pot canonical flow
- [ ] Implement global leaderboard canonical selection
- [ ] Implement rivalry-win tie-break stage
- [ ] Implement Matchday 2 completion lock job
- [ ] Ensure post-lock pot progression uses canonical context only

Acceptance:
- [ ] One canonical entry per user verified

## Day 7 - Frontend core UX
- [ ] Wallet/balance/purchase UI
- [ ] Power-up targeting and activation UI
- [ ] Global pot leaderboard UI
- [ ] New-user Terms acceptance gate in onboarding/auth flow

Acceptance:
- [ ] End-to-end user journey functions in staging

## Day 8 - Ads and i18n framework
- [ ] Add sponsor/native AdSlot system
- [ ] Place ads on dashboard/predictions/group details with UX guardrails
- [ ] Add i18n framework and locale switcher
- [ ] Translate core flows (EN/ES/FR)

Acceptance:
- [ ] Ads non-intrusive and locale switching stable

## Day 9 - Legal localization, docs, QA, launch
- [ ] Translate Terms and Privacy EN/ES/FR
- [ ] Finalize legal clauses (18+, no refunds, verification payout)
- [ ] Update changelog release notes
- [ ] Update projectguide architecture/API/rules sections
- [ ] Complete pre-launch QA pass and rollout checks

Acceptance:
- [ ] Release checklist complete and approved

---

## 4) Key files to change

### Existing (planned)
- `backend/app/db/models.py`
- `backend/app/db/__init__.py`
- `backend/app/db/session.py`
- `backend/app/db/repository.py`
- `backend/app/services/unified_transaction_manager.py`
- `backend/lambda/match_processor_lambda.py` (if active)
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/config_prod.py`
- `backend/app/schemas/__init__.py`
- `backend/app/routers/analytics.py`
- `frontend/src/api/index.js`
- `frontend/src/contexts/AppContext.js`
- `frontend/src/components/layout/MainLayout.jsx`
- `frontend/src/components/dashboard/Dashboard.jsx`
- `frontend/src/pages/PredictionsPage.jsx`
- `frontend/src/pages/GroupDetailsPage.jsx`
- `frontend/src/pages/SettingsPage.jsx`
- `frontend/src/pages/TermsPage.jsx`
- `frontend/src/pages/PrivacyPage.jsx`
- `changelog`
- `projectguide`

### New (planned)
- `backend/app/services/coin_service.py`
- `backend/app/services/powerup_service.py`
- `backend/app/services/payment_service.py`
- `backend/app/routers/wallet.py`
- `backend/app/routers/powerups.py`
- `backend/app/routers/payments.py`
- `backend/app/routers/worldcup.py` (or analytics extension)
- `frontend/src/components/ads/AdSlot.jsx`
- `frontend/src/components/ads/SponsoredCard.jsx`
- `frontend/src/utils/adConfig.js`
- `frontend/src/i18n/index.js`
- `frontend/src/locales/en.json`
- `frontend/src/locales/es.json`
- `frontend/src/locales/fr.json`
- `frontend/src/pages/WalletPage.jsx`
- `frontend/src/pages/PowerUpsPage.jsx`
- `frontend/src/pages/GlobalLeaderboardPage.jsx`

---

## 5) Sign-off log

- [ ] Product rules sign-off
- [ ] Legal draft sign-off
- [ ] Payments setup sign-off
- [ ] Pre-launch QA sign-off
- [ ] Production release sign-off

Last updated: 2026-04-25
