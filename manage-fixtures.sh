#!/usr/bin/env python3
"""
Simple script to import fixtures into your local development database
Run this from your project root directory after starting docker-compose
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timezone, timedelta

# Add backend to Python path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Import backend modules
from app.db.session import SessionLocal, engine
from app.db.models import Base, Fixture, MatchStatus, Team
from app.core.config import settings
from app.services.football_api import football_api_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configuration
LEAGUES = {
    "Premier League": 39,
    "La Liga": 140,
    "UEFA Champions League": 2
}
CURRENT_SEASON = 2024

def check_requirements():
    """Check if all requirements are met"""
    # Check API key
    if not settings.FOOTBALL_API_KEY:
        logger.error("FOOTBALL_API_KEY is not set!")
        logger.error("Please set your API key in backend/.env file:")
        logger.error("FOOTBALL_API_KEY=your_api_key_here")
        logger.error("Get your API key from: https://www.api-football.com/")
        return False
    
    # Check database connection
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        logger.error("Make sure Docker containers are running: docker-compose up -d")
        return False
    
    return True

def create_tables():
    """Create database tables"""
    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create tables: {e}")
        raise

async def import_teams():
    """Import teams from API"""
    logger.info("Importing teams...")
    db = SessionLocal()
    total_imported = 0
    
    try:
        for league_name, league_id in LEAGUES.items():
            logger.info(f"Importing teams for {league_name}")
            
            # Get teams from API
            teams_data = await football_api_service.make_api_request('teams', {
                'league': league_id,
                'season': CURRENT_SEASON
            })
            
            if not teams_data:
                logger.warning(f"No teams data for {league_name}")
                continue
            
            count = 0
            for team_info in teams_data:
                team_data = team_info.get('team', {})
                if not team_data:
                    continue
                
                # Check if team exists
                existing = db.query(Team).filter(Team.team_id == team_data['id']).first()
                if existing:
                    continue
                
                # Create team
                team = Team(
                    team_id=team_data['id'],
                    team_name=team_data['name'],
                    team_logo=team_data.get('logo'),
                    country=team_data.get('country'),
                    league_id=league_id
                )
                db.add(team)
                count += 1
            
            db.commit()
            logger.info(f"Imported {count} teams for {league_name}")
            total_imported += count
    
    except Exception as e:
        logger.error(f"Error importing teams: {e}")
        db.rollback()
    finally:
        db.close()
    
    return total_imported

async def import_fixtures():
    """Import fixtures from API"""
    logger.info("Importing fixtures...")
    db = SessionLocal()
    total_imported = 0
    
    # Date range: 30 days back, 60 days forward
    today = datetime.now(timezone.utc)
    from_date = today - timedelta(days=30)
    to_date = today + timedelta(days=60)
    
    logger.info(f"Importing fixtures from {from_date.date()} to {to_date.date()}")
    
    try:
        for league_name, league_id in LEAGUES.items():
            logger.info(f"Importing fixtures for {league_name}")
            
            # Get fixtures from API
            fixtures_data = await football_api_service.make_api_request('fixtures', {
                'league': league_id,
                'season': CURRENT_SEASON,
                'from': from_date.strftime('%Y-%m-%d'),
                'to': to_date.strftime('%Y-%m-%d')
            })
            
            if not fixtures_data:
                logger.warning(f"No fixtures data for {league_name}")
                continue
            
            count = 0
            for fixture_data in fixtures_data:
                try:
                    fixture_id = fixture_data['fixture']['id']
                    
                    # Check if fixture exists
                    existing = db.query(Fixture).filter(Fixture.fixture_id == fixture_id).first()
                    if existing:
                        continue
                    
                    # Parse date
                    date_str = fixture_data['fixture']['date']
                    if date_str.endswith('Z'):
                        date_str = date_str[:-1] + '+00:00'
                    fixture_datetime = datetime.fromisoformat(date_str)
                    
                    # Map status
                    api_status = fixture_data['fixture']['status']['short']
                    status_map = {
                        'TBD': MatchStatus.NOT_STARTED, 'NS': MatchStatus.NOT_STARTED,
                        '1H': MatchStatus.FIRST_HALF, 'HT': MatchStatus.HALFTIME,
                        '2H': MatchStatus.SECOND_HALF, 'ET': MatchStatus.EXTRA_TIME,
                        'P': MatchStatus.PENALTY, 'FT': MatchStatus.FINISHED,
                        'AET': MatchStatus.FINISHED_AET, 'PEN': MatchStatus.FINISHED_PEN,
                        'LIVE': MatchStatus.LIVE
                    }
                    status = status_map.get(api_status, MatchStatus.NOT_STARTED)
                    
                    # Get scores
                    goals = fixture_data.get('goals', {})
                    home_score = goals.get('home') or 0
                    away_score = goals.get('away') or 0
                    
                    # Create fixture
                    fixture = Fixture(
                        fixture_id=fixture_id,
                        home_team=fixture_data['teams']['home']['name'],
                        away_team=fixture_data['teams']['away']['name'],
                        home_team_logo=fixture_data['teams']['home'].get('logo'),
                        away_team_logo=fixture_data['teams']['away'].get('logo'),
                        date=fixture_datetime,
                        league=league_name,
                        season=str(CURRENT_SEASON),
                        round=fixture_data['league'].get('round', 'Round 1'),
                        status=status,
                        home_score=home_score,
                        away_score=away_score,
                        venue=fixture_data['fixture']['venue'].get('name') if fixture_data['fixture'].get('venue') else None,
                        venue_city=fixture_data['fixture']['venue'].get('city') if fixture_data['fixture'].get('venue') else None,
                        competition_id=league_id,
                        match_timestamp=fixture_datetime,
                        last_updated=datetime.now(timezone.utc),
                        league_id=league_id
                    )
                    
                    db.add(fixture)
                    count += 1
                    
                except Exception as e:
                    logger.error(f"Error processing fixture {fixture_data['fixture']['id']}: {e}")
                    continue
            
            db.commit()
            logger.info(f"Imported {count} fixtures for {league_name}")
            total_imported += count
    
    except Exception as e:
        logger.error(f"Error importing fixtures: {e}")
        db.rollback()
    finally:
        db.close()
    
    return total_imported

def show_stats():
    """Show database statistics"""
    db = SessionLocal()
    try:
        teams_count = db.query(Team).count()
        fixtures_count = db.query(Fixture).count()
        
        print("\n" + "="*50)
        print("DATABASE STATISTICS")
        print("="*50)
        print(f"Teams: {teams_count}")
        print(f"Fixtures: {fixtures_count}")
        
        # Show by league
        print("\nFixtures by league:")
        for league_name in LEAGUES.keys():
            count = db.query(Fixture).filter(Fixture.league == league_name).count()
            print(f"  {league_name}: {count}")
        
        # Show by status
        print("\nFixtures by status:")
        for status in MatchStatus:
            count = db.query(Fixture).filter(Fixture.status == status).count()
            if count > 0:
                print(f"  {status.value}: {count}")
        
        print("="*50)
        
    finally:
        db.close()

async def main():
    """Main function"""
    print("Football Fixtures Import Script")
    print("=" * 40)
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    try:
        # Create tables
        create_tables()
        
        # Show initial stats
        print("\nBefore import:")
        show_stats()
        
        # Import data
        teams_imported = await import_teams()
        fixtures_imported = await import_fixtures()
        
        # Show final stats
        print(f"\nImport completed!")
        print(f"Teams imported: {teams_imported}")
        print(f"Fixtures imported: {fixtures_imported}")
        
        print("\nAfter import:")
        show_stats()
        
        if fixtures_imported > 0:
            print("\n✓ Import successful! Your fixtures table is now populated.")
            print("You can now test your app with real fixture data.")
        else:
            print("\n⚠ No new fixtures imported (data may already exist)")
    
    except Exception as e:
        logger.error(f"Import failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Run the import
    asyncio.run(main())