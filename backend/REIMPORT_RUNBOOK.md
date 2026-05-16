# Fixture re-import runbook

Use this after changing season resolution (`SeasonManager`) or API defaults so database fixtures match the API slice the app queries.

## Preconditions

- `FOOTBALL_API_KEY` set for the environment.
- Database reachable from the host running the import.
- Optional: set `CLUB_WORLD_CUP_API_SEASON` if API-Football expects a non-calendar year for FIFA Club World Cup (league id 15).

## Steps (staging first, then production)

1. Deploy application code that uses `SeasonManager` for import paths and API season parameters.
2. Run the fixture import for every supported league (your `import_fixtures` script, lambda, or scheduled job). Use upsert mode if available so existing rows refresh.
3. Spot-check: for each league, confirm stored `season` matches `SeasonManager.get_current_season(league)` in DB format and that upcoming fixtures exist for the current API season.
4. Smoke-test predictions and leaderboards per league.

## Rollback

Re-deploy the previous application version only if the new code is faulty. Data imported under the new season model may still need a second import after rollback if API season parameters differ.
