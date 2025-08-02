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
    }
  };
  
  export class SeasonManager {
    /**
     * Get the current season for a league in database format
     */
    static getCurrentSeason(leagueName) {
      const config = LEAGUE_CONFIGS[leagueName];
      if (!config) {
        return new Date().getFullYear().toString();
      }
  
      const now = new Date();
      
      if (config.type === LeagueType.EUROPEAN) {
        // European season runs Aug-May
        let startYear, endYear;
        if (now.getMonth() >= 7) { // August or later (month is 0-indexed)
          startYear = now.getFullYear();
          endYear = now.getFullYear() + 1;
        } else {
          startYear = now.getFullYear() - 1;
          endYear = now.getFullYear();
        }
        return `${startYear}-${endYear}`;
      } else {
        // Calendar year leagues (MLS, tournaments)
        return now.getFullYear().toString();
      }
    }
  
    /**
     * Convert database season format to display format
     */
    static getSeasonForDisplay(leagueName, dbSeason) {
      const config = LEAGUE_CONFIGS[leagueName];
      if (!config || !dbSeason) {
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
      const currentYear = new Date().getFullYear();
      const seasons = [];
  
      if (!config) {
        // Default to calendar years for unknown leagues
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
  
      if (config.type === LeagueType.EUROPEAN) {
        // Generate European seasons
        for (let i = 0; i <= yearsBack; i++) {
          const startYear = currentYear - i;
          const endYear = startYear + 1;
          
          const dbFormat = `${startYear}-${endYear}`;
          const displayFormat = `${startYear}-${endYear.toString().slice(-2)}`;
          
          seasons.push({
            value: dbFormat,
            label: displayFormat,
            dbFormat: dbFormat
          });
        }
      } else {
        // Calendar year leagues
        for (let i = 0; i <= yearsBack; i++) {
          const year = currentYear - i;
          seasons.push({
            value: year.toString(),
            label: year.toString(),
            dbFormat: year.toString()
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