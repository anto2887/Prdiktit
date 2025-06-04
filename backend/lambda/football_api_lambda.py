# lambda/football_api_lambda.py
import json
import os
import boto3
import requests
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize clients
ssm = boto3.client('ssm')
dynamodb = boto3.resource('dynamodb')

# Constants
API_BASE_URL = "https://v3.football.api-sports.io"
API_KEY_PARAM_NAME = "/football-api/api-key"
FIXTURES_TABLE_NAME = os.environ.get('FIXTURES_TABLE', 'football-fixtures')

fixtures_table = dynamodb.Table(FIXTURES_TABLE_NAME)

def get_api_key() -> str:
    """Get API key from Parameter Store"""
    try:
        response = ssm.get_parameter(
            Name=API_KEY_PARAM_NAME,
            WithDecryption=True
        )
        return response['Parameter']['Value']
    except Exception as e:
        logger.error(f"Error retrieving API key: {e}")
        raise

def make_api_request(endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Make request to football API"""
    api_key = get_api_key()
    
    headers = {
        'x-rapidapi-key': api_key,
        'x-rapidapi-host': 'v3.football.api-sports.io'
    }
    
    url = f"{API_BASE_URL}/{endpoint}"
    
    try:
        logger.info(f"Making API request to: {url} with params: {params}")
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        if not data.get('response') and data.get('errors'):
            logger.error(f"API Error: {data['errors']}")
            return None
        
        logger.info(f"API request successful. Found {len(data.get('response', []))} items")
        return data.get('response', [])
    
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP Error: {e}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"API Request failed: {e}")
        return None

def get_fixtures_by_season(league_id: int, season: int) -> Optional[List[Dict[str, Any]]]:
    """Get fixtures for a specific league and season"""
    params = {
        'league': league_id,
        'season': season
    }
    return make_api_request('fixtures', params)

def get_live_fixtures(league_id: int) -> Optional[List[Dict[str, Any]]]:
    """Get live fixtures for a specific league"""
    params = {
        'league': league_id,
        'live': 'all'
    }
    return make_api_request('fixtures', params)

def get_fixture_by_id(fixture_id: int) -> Optional[Dict[str, Any]]:
    """Get fixture by ID"""
    params = {
        'id': fixture_id
    }
    fixtures = make_api_request('fixtures', params)
    return fixtures[0] if fixtures and len(fixtures) > 0 else None

def save_fixtures_to_dynamodb(fixtures: List[Dict[str, Any]]) -> None:
    """Save fixtures to DynamoDB"""
    try:
        for fixture_data in fixtures:
            try:
                # Parse fixture date to ISO format
                fixture_date = fixture_data['fixture']['date']
                if isinstance(fixture_date, int):
                    fixture_datetime = datetime.fromtimestamp(fixture_date)
                else:
                    fixture_datetime = datetime.strptime(fixture_date, '%Y-%m-%dT%H:%M:%S%z')
                
                # Map status
                status_mapping = {
                    "Not Started": "NOT_STARTED",
                    "First Half": "FIRST_HALF",
                    "Halftime": "HALFTIME",
                    "Second Half": "SECOND_HALF",
                    "Extra Time": "EXTRA_TIME",
                    "Penalty In Progress": "PENALTY",
                    "Match Finished": "FINISHED",
                    "Match Finished After Extra Time": "FINISHED_AET",
                    "Match Finished After Penalty": "FINISHED_PEN",
                    "Break Time": "BREAK_TIME",
                    "Match Suspended": "SUSPENDED",
                    "Match Interrupted": "INTERRUPTED",
                    "Match Postponed": "POSTPONED",
                    "Match Cancelled": "CANCELLED",
                    "Match Abandoned": "ABANDONED",
                    "Technical Loss": "TECHNICAL_LOSS",
                    "Walkover": "WALKOVER",
                    "Live": "LIVE"
                }
                
                status = status_mapping.get(
                    fixture_data['fixture']['status']['long'],
                    "NOT_STARTED"
                )
                
                # Create item for DynamoDB
                item = {
                    'fixture_id': fixture_data['fixture']['id'],
                    'home_team': fixture_data['teams']['home']['name'],
                    'away_team': fixture_data['teams']['away']['name'],
                    'home_team_logo': fixture_data['teams']['home']['logo'],
                    'away_team_logo': fixture_data['teams']['away']['logo'],
                    'date': fixture_datetime.isoformat(),
                    'league': fixture_data['league']['name'],
                    'season': str(fixture_data['league']['season']),
                    'round': fixture_data['league']['round'],
                    'status': status,
                    'home_score': fixture_data['goals']['home'] if fixture_data['goals']['home'] is not None else 0,
                    'away_score': fixture_data['goals']['away'] if fixture_data['goals']['away'] is not None else 0,
                    'venue_city': fixture_data['fixture']['venue']['city'],
                    'competition_id': fixture_data['league']['id'],
                    'match_timestamp': fixture_datetime.isoformat(),
                    'last_checked': datetime.now(timezone.utc).isoformat()
                }
                
                # Add scores if available
                if 'score' in fixture_data:
                    if 'halftime' in fixture_data['score']:
                        item['halftime_score'] = f"{fixture_data['score']['halftime']['home']}-{fixture_data['score']['halftime']['away']}"
                    if 'fulltime' in fixture_data['score']:
                        item['fulltime_score'] = f"{fixture_data['score']['fulltime']['home']}-{fixture_data['score']['fulltime']['away']}"
                    if 'extratime' in fixture_data['score']:
                        item['extratime_score'] = f"{fixture_data['score']['extratime']['home']}-{fixture_data['score']['extratime']['away']}"
                    if 'penalty' in fixture_data['score']:
                        item['penalty_score'] = f"{fixture_data['score']['penalty']['home']}-{fixture_data['score']['penalty']['away']}"
                
                # Save to DynamoDB
                fixtures_table.put_item(Item=item)
                logger.info(f"Saved fixture {fixture_data['fixture']['id']} to DynamoDB")
                
            except Exception as e:
                logger.error(f"Error processing fixture {fixture_data['fixture']['id']}: {e}")
                continue
    except Exception as e:
        logger.error(f"Error saving fixtures to DynamoDB: {e}")
        raise

def handle_daily_update(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Handle daily fixtures update"""
    try:
        leagues = {
            "Premier League": {"id": 39, "season": 2024},
            "La Liga": {"id": 140, "season": 2024},
            "UEFA Champions League": {"id": 2, "season": 2024},
            "MLS": {"id": 253, "season": 2025}
        }
        
        for league_name, league_config in leagues.items():
            logger.info(f"Processing fixtures for {league_name}")
            
            fixtures = get_fixtures_by_season(league_config['id'], league_config['season'])
            
            if fixtures:
                logger.info(f"Retrieved {len(fixtures)} fixtures for {league_name}")
                save_fixtures_to_dynamodb(fixtures)
            else:
                logger.info(f"No fixtures found for {league_name}")
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Daily update completed successfully"
            })
        }
    
    except Exception as e:
        logger.error(f"Error in daily update: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }

def handle_live_matches(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Handle live matches update"""
    try:
        leagues = {
            "Premier League": {"id": 39, "season": 2024},
            "La Liga": {"id": 140, "season": 2024},
            "UEFA Champions League": {"id": 2, "season": 2024},
            "MLS": {"id": 253, "season": 2025}
        }
        
        for league_name, league_config in leagues.items():
            logger.info(f"Processing live matches for {league_name}")
            
            live_matches = get_live_fixtures(league_config['id'])
            
            if live_matches:
                logger.info(f"Retrieved {len(live_matches)} live matches for {league_name}")
                save_fixtures_to_dynamodb(live_matches)
            else:
                logger.info(f"No live matches found for {league_name}")
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Live matches update completed successfully"
            })
        }
    
    except Exception as e:
        logger.error(f"Error in live matches update: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }

def handle_fixture_detail(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Handle fixture detail request"""
    try:
        # Extract fixture ID from path or query parameters
        fixture_id = None
        
        if event.get('pathParameters') and 'fixture_id' in event['pathParameters']:
            fixture_id = int(event['pathParameters']['fixture_id'])
        elif event.get('queryStringParameters') and 'fixture_id' in event['queryStringParameters']:
            fixture_id = int(event['queryStringParameters']['fixture_id'])
        
        if not fixture_id:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": "Missing fixture ID"
                })
            }
        
        fixture = get_fixture_by_id(fixture_id)
        
        if not fixture:
            return {
                "statusCode": 404,
                "body": json.dumps({
                    "error": "Fixture not found"
                })
            }
        
        # Save to DynamoDB
        save_fixtures_to_dynamodb([fixture])
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Fixture details updated successfully",
                "fixture_id": fixture_id
            })
        }
    
    except Exception as e:
        logger.error(f"Error in fixture detail: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Main Lambda handler"""
    try:
        # Determine operation from event
        operation = event.get('operation')
        
        if not operation and event.get('body'):
            # Try to parse from request body
            body = json.loads(event['body'])
            operation = body.get('operation')
        
        if not operation:
            # Default to daily update
            operation = 'daily_update'
        
        # Call appropriate handler based on operation
        if operation == 'daily_update':
            return handle_daily_update(event, context)
        elif operation == 'live_matches':
            return handle_live_matches(event, context)
        elif operation == 'fixture_detail':
            return handle_fixture_detail(event, context)
        else:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": f"Unsupported operation: {operation}"
                })
            }
    
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }