// frontend/src/utils/seasonManager.js
/**
 * Frontend season management utilities
 * Mirrors the backend SeasonManager for consistent handling
 */

export const LeagueType = {
    EUROPEAN: 'european',
    CALENDAR_YEAR: 'calendar_year', 
    MLS: 'mls',
    TOURNAMENT: 'tournament'
  };
  
  export const LEAGUE_CONFIGS = {
    'Premier League': {
      type: LeagueType.EUROPEAN,
      apiId: 39,
      displayFormat: '{startYear}-{endYearShort}', // "2024-25"
      dbFormat: '{startYear}-{endYear}', // "2024-2025"
      apiSeason: '{startYear}'
    },
    'La Liga': {
      type: LeagueType.EUROPEAN,
      apiId: 140,
      displayFormat: '{startYear}-{endYearShort}',
      dbFormat: '{startYear}-{endYear}',
      apiSeason: '{startYear}'
    },
    'UEFA Champions League': {
      type: LeagueType.EUROPEAN,
      apiId: 2,
      displayFormat: '{startYear}-{endYearShort}',
      dbFormat: '{startYear}-{endYear}',
      apiSeason: '{startYear}'
    },
    'MLS': {
      type: LeagueType.MLS,
      apiId: 253,
      displayFormat: '{year}', // "2025"
      dbFormat: '{year}', // "2025"
      apiSeason: '{year}'
    },
    'FIFA Club World Cup': {
      type: LeagueType.TOURNAMENT,
      apiId: 15,
      displayFormat: '{year}',
      dbFormat: '{year}',
      apiSeason: '{year}'
    },
    'World Cup': {
      type: LeagueType.TOURNAMENT,
      apiId: 1,
      displayFormat: '{year}',
      dbFormat: '{year}',
      apiSeason: '{year}',
      pinnedDbSeason: '2026'
    }
  };

  function warnUnknownLeague(method, leagueName) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `SeasonManager.${method}: unknown league "${leagueName}" — using best-effort fallback`
      );
    }
  }

  function europeanCampaignStartYear(now) {
    if (now.getMonth() >= 7) {
      return now.getFullYear();
    }
    return now.getFullYear() - 1;
  }

  /** MLS campaign label year: February flip (option A); January -> prior year. */
  function mlsCampaignCalendarYear(now) {
    if (now.getMonth() >= 1) {
      return now.getFullYear();
    }
    return now.getFullYear() - 1;
  }
  
  export class SeasonManager {
    /**
     * Get the current season for a league in database format
     */
    static getCurrentSeason(leagueName) {
      const config = LEAGUE_CONFIGS[leagueName];
      if (!config) {
        warnUnknownLeague('getCurrentSeason', leagueName);
        return new Date().getFullYear().toString();
      }

      if (config.pinnedDbSeason) {
        return config.pinnedDbSeason;
      }
  
      const now = new Date();
      
      if (config.type === LeagueType.EUROPEAN) {
        const startYear = europeanCampaignStartYear(now);
        const endYear = startYear + 1;
        return `${startYear}-${endYear}`;
      }

      if (config.type === LeagueType.MLS) {
        return String(mlsCampaignCalendarYear(now));
      }

      if (config.type === LeagueType.CALENDAR_YEAR) {
        return String(now.getFullYear());
      }

      if (leagueName === 'FIFA Club World Cup') {
        const override = (typeof process !== 'undefined' && process.env.REACT_APP_CLUB_WORLD_CUP_API_SEASON) || '';
        if (override.trim()) {
          return override.trim();
        }
      }

      return String(now.getFullYear());
    }
  
    /**
     * Convert database season format to display format
     */
    static getSeasonForDisplay(leagueName, dbSeason) {
      const config = LEAGUE_CONFIGS[leagueName];
      if (!config || !dbSeason) {
        if (!config && dbSeason) {
          warnUnknownLeague('getSeasonForDisplay', leagueName);
        }
        return dbSeason;
      }
  
      if (config.type === LeagueType.EUROPEAN) {
        if (dbSeason.includes('-')) {
          const [startYear, endYear] = dbSeason.split('-');
          const endYearShort = endYear.slice(-2); // "2025" -> "25"
          return `${startYear}-${endYearShort}`;
        }
      }
      
      return dbSeason;
    }
  
    /**
     * Convert any season format to database format
     */
    static convertToDbFormat(leagueName, seasonInput) {
      const config = LEAGUE_CONFIGS[leagueName];
      if (!config) {
        warnUnknownLeague('convertToDbFormat', leagueName);
      }
      if (!config || !seasonInput) {
        return seasonInput;
      }
  
      if (config.type === LeagueType.EUROPEAN) {
        if (seasonInput.includes('-')) {
          const parts = seasonInput.split('-');
          const startYear = parts[0];
          const endPart = parts[1];
          
          // Handle both "24" and "2024" end formats
          let endYear;
          if (endPart.length === 2) {
            endYear = startYear.slice(0, 2) + endPart; // "2024" + "25" = "2025"
          } else {
            endYear = endPart;
          }
          
          return `${startYear}-${endYear}`;
        } else {
          // Single year input, assume European format
          const startYear = parseInt(seasonInput);
          const endYear = startYear + 1;
          return `${startYear}-${endYear}`;
        }
      }
      
      return seasonInput;
    }
  
    /**
     * Get list of available seasons for a league
     */
    static getAvailableSeasons(leagueName, yearsBack = 5) {
      const config = LEAGUE_CONFIGS[leagueName];
      const now = new Date();
      const seasons = [];
  
      if (!config) {
        warnUnknownLeague('getAvailableSeasons', leagueName);
        const currentYear = now.getFullYear();
        for (let i = 0; i <= yearsBack; i++) {
          const year = currentYear - i;
          seasons.push({
            value: year.toString(),
            label: year.toString(),
            dbFormat: year.toString()
          });
        }
        return seasons;
      }

      if (config.pinnedDbSeason) {
        const anchor = parseInt(config.pinnedDbSeason, 10);
        const base = Number.isFinite(anchor) ? anchor : now.getFullYear();
        for (let i = 0; i <= yearsBack; i++) {
          const y = base - 4 * i;
          const ys = String(y);
          seasons.push({ value: ys, label: ys, dbFormat: ys });
        }
        return seasons;
      }
  
      if (config.type === LeagueType.EUROPEAN) {
        const startYear = europeanCampaignStartYear(now);
        for (let i = 0; i <= yearsBack; i++) {
          const sy = startYear - i;
          const ey = sy + 1;
          const dbFormat = `${sy}-${ey}`;
          const displayFormat = `${sy}-${ey.toString().slice(-2)}`;
          seasons.push({
            value: dbFormat,
            label: displayFormat,
            dbFormat: dbFormat
          });
        }
      } else if (config.type === LeagueType.MLS) {
        const anchor = mlsCampaignCalendarYear(now);
        for (let i = 0; i <= yearsBack; i++) {
          const year = anchor - i;
          seasons.push({
            value: String(year),
            label: String(year),
            dbFormat: String(year)
          });
        }
      } else {
        let anchor;
        try {
          anchor = parseInt(SeasonManager.getCurrentSeason(leagueName), 10);
        } catch {
          anchor = now.getFullYear();
        }
        if (!Number.isFinite(anchor)) {
          anchor = now.getFullYear();
        }
        for (let i = 0; i <= yearsBack; i++) {
          const year = anchor - i;
          seasons.push({
            value: String(year),
            label: String(year),
            dbFormat: String(year)
          });
        }
      }
  
      return seasons;
    }
  
    /**
     * Normalize season input for API queries
     */
    static normalizeSeasonForQuery(leagueName, seasonInput) {
      if (!seasonInput) {
        return this.getCurrentSeason(leagueName);
      }
      
      return this.convertToDbFormat(leagueName, seasonInput);
    }
  
    /**
     * Check if season format is valid for league
     */
    static isValidSeasonFormat(leagueName, season) {
      const config = LEAGUE_CONFIGS[leagueName];
      if (!config) {
        warnUnknownLeague('isValidSeasonFormat', leagueName);
        return true; // Accept any format for unknown leagues
      }
  
      if (config.type === LeagueType.EUROPEAN) {
        // Should be "YYYY-YYYY" format
        if (!season.includes('-')) {
          return false;
        }
        const parts = season.split('-');
        if (parts.length !== 2) {
          return false;
        }
        try {
          const startYear = parseInt(parts[0]);
          const endYear = parseInt(parts[1]);
          return endYear === startYear + 1;
        } catch {
          return false;
        }
      } else {
        // Calendar year should be just "YYYY"
        try {
          const year = parseInt(season);
          return season.length === 4 && !isNaN(year);
        } catch {
          return false;
        }
      }
    }
  
    /**
     * Get league configuration
     */
    static getLeagueConfig(leagueName) {
      return LEAGUE_CONFIGS[leagueName] || null;
    }
  
    /**
     * Get league type
     */
    static getLeagueType(leagueName) {
      const config = LEAGUE_CONFIGS[leagueName];
      return config ? config.type : LeagueType.CALENDAR_YEAR;
    }
  }
  
  export default SeasonManager;