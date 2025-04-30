import asyncio
import logging
from app.services.football_api import football_api_service
from app.db.session import SessionLocal
from app.db.models import Team

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def import_teams():
    db = SessionLocal()
    try:
        leagues = {
            "Premier League": 39,
            "La Liga": 140, 
            "UEFA Champions League": 2
        }
        
        for league_name, league_id in leagues.items():
            logger.info(f"Importing teams for {league_name} (ID: {league_id})")
            params = {
                'league': league_id,
                'season': 2024  # Current season
            }
            
            # Make the API request
            teams_data = await football_api_service.make_api_request('teams', params)
            
            if teams_data:
                logger.info(f"Found {len(teams_data)} teams for {league_name}")
                count = 0
                for team_data in teams_data:
                    # Check if team already exists
                    existing_team = db.query(Team).filter(Team.team_id == team_data['team']['id']).first()
                    if existing_team:
                        logger.info(f"Team {team_data['team']['name']} already exists, skipping")
                        continue
                        
                    # Create new team
                    team = Team(
                        team_id=team_data['team']['id'],
                        team_name=team_data['team']['name'],
                        team_logo=team_data['team']['logo'],
                        country=team_data['team']['country'],
                        league_id=league_id
                    )
                    db.add(team)
                    count += 1
                
                db.commit()
                logger.info(f"Added {count} teams for {league_name}")
            else:
                logger.warning(f"No teams found for {league_name}")
    except Exception as e:
        logger.error(f"Error importing teams: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(import_teams())
