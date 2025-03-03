# lambda/match_processor_lambda.py
import json
import os
import boto3
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from decimal import Decimal

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize clients
dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

# Constants
FIXTURES_TABLE_NAME = os.environ.get('FIXTURES_TABLE', 'football-fixtures')
PREDICTIONS_TABLE_NAME = os.environ.get('PREDICTIONS_TABLE', 'user-predictions')
USER_RESULTS_TABLE_NAME = os.environ.get('USER_RESULTS_TABLE', 'user-results')
NOTIFICATION_QUEUE_URL = os.environ.get('NOTIFICATION_QUEUE_URL', '')

# Initialize DynamoDB tables
fixtures_table = dynamodb.Table(FIXTURES_TABLE_NAME)
predictions_table = dynamodb.Table(PREDICTIONS_TABLE_NAME)
user_results_table = dynamodb.Table(USER_RESULTS_TABLE_NAME)

# Match status enums
class MatchStatus:
    NOT_STARTED = "NOT_STARTED"
    FIRST_HALF = "FIRST_HALF"
    HALFTIME = "HALFTIME"
    SECOND_HALF = "SECOND_HALF"
    EXTRA_TIME = "EXTRA_TIME"
    PENALTY = "PENALTY"
    FINISHED = "FINISHED"
    FINISHED_AET = "FINISHED_AET"
    FINISHED_PEN = "FINISHED_PEN"
    BREAK_TIME = "BREAK_TIME"
    SUSPENDED = "SUSPENDED"
    INTERRUPTED = "INTERRUPTED"
    POSTPONED = "POSTPONED"
    CANCELLED = "CANCELLED"
    ABANDONED = "ABANDONED"
    TECHNICAL_LOSS = "TECHNICAL_LOSS"
    WALKOVER = "WALKOVER"
    LIVE = "LIVE"

# Prediction status enums
class PredictionStatus:
    EDITABLE = "EDITABLE"
    SUBMITTED = "SUBMITTED"
    LOCKED = "LOCKED"
    PROCESSED = "PROCESSED"

def get_completed_matches() -> List[Dict[str, Any]]:
    """Get all completed matches that need processing"""
    try:
        response = fixtures_table.scan(
            FilterExpression="(#status = :finished OR #status = :finished_aet OR #status = :finished_pen) AND attribute_not_exists(#processed)",
            ExpressionAttributeNames={
                '#status': 'status',
                '#processed': 'processed'
            },
            ExpressionAttributeValues={
                ':finished': MatchStatus.FINISHED,
                ':finished_aet': MatchStatus.FINISHED_AET,
                ':finished_pen': MatchStatus.FINISHED_PEN
            }
        )
        
        return response.get('Items', [])
    except Exception as e:
        logger.error(f"Error getting completed matches: {e}")
        return []

def get_predictions_for_match(fixture_id: int) -> List[Dict[str, Any]]:
    """Get all predictions for a specific match"""
    try:
        response = predictions_table.scan(
            FilterExpression="#fixture_id = :fixture_id AND #status = :locked_status",
            ExpressionAttributeNames={
                '#fixture_id': 'fixture_id',
                '#status': 'prediction_status'
            },
            ExpressionAttributeValues={
                ':fixture_id': fixture_id,
                ':locked_status': PredictionStatus.LOCKED
            }
        )
        
        return response.get('Items', [])
    except Exception as e:
        logger.error(f"Error getting predictions for match {fixture_id}: {e}")
        return []

def calculate_points(
    pred_home: int, 
    pred_away: int, 
    actual_home: int, 
    actual_away: int
) -> int:
    """
    Calculate points for a prediction
    
    3 points - Exact score
    1 point - Correct result (win/draw/loss)
    0 points - Incorrect
    """
    # Exact score match
    if pred_home == actual_home and pred_away == actual_away:
        return 3
        
    # Correct result
    pred_result = pred_home - pred_away
    actual_result = actual_home - actual_away
    
    if (pred_result > 0 and actual_result > 0) or \
       (pred_result < 0 and actual_result < 0) or \
       (pred_result == 0 and actual_result == 0):
        return 1
        
    return 0

def update_prediction(prediction: Dict[str, Any], points: int) -> None:
    """Update prediction with points and mark as processed"""
    try:
        predictions_table.update_item(
            Key={
                'id': prediction['id']
            },
            UpdateExpression="SET #points = :points, #status = :processed_status, #processed_at = :processed_at",
            ExpressionAttributeNames={
                '#points': 'points',
                '#status': 'prediction_status',
                '#processed_at': 'processed_at'
            },
            ExpressionAttributeValues={
                ':points': Decimal(str(points)),
                ':processed_status': PredictionStatus.PROCESSED,
                ':processed_at': datetime.now(timezone.utc).isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Error updating prediction {prediction['id']}: {e}")
        raise

def update_user_results(user_id: int, season: str, week: int, points: int) -> None:
    """Update user season results with points"""
    try:
        # Check if user already has results for this season
        response = user_results_table.get_item(
            Key={
                'user_id': user_id,
                'season': season
            }
        )
        
        if 'Item' in response:
            # Update existing results
            user_results_table.update_item(
                Key={
                    'user_id': user_id,
                    'season': season
                },
                UpdateExpression="SET #points = #points + :points_to_add",
                ExpressionAttributeNames={
                    '#points': 'points'
                },
                ExpressionAttributeValues={
                    ':points_to_add': Decimal(str(points))
                }
            )
        else:
            # Create new results
            user_results_table.put_item(
                Item={
                    'user_id': user_id,
                    'season': season,
                    'week': week,
                    'points': Decimal(str(points))
                }
            )
    except Exception as e:
        logger.error(f"Error updating user results for user {user_id}: {e}")
        raise

def mark_match_as_processed(fixture_id: int) -> None:
    """Mark match as processed in fixtures table"""
    try:
        fixtures_table.update_item(
            Key={
                'fixture_id': fixture_id
            },
            UpdateExpression="SET #processed = :processed",
            ExpressionAttributeNames={
                '#processed': 'processed'
            },
            ExpressionAttributeValues={
                ':processed': True
            }
        )
    except Exception as e:
        logger.error(f"Error marking match {fixture_id} as processed: {e}")
        raise

def send_notification(user_id: int, fixture_id: int, points: int, match_data: Dict[str, Any]) -> None:
    """Send notification to user about processed prediction"""
    if not NOTIFICATION_QUEUE_URL:
        return
        
    try:
        notification = {
            'user_id': user_id,
            'type': 'prediction_processed',
            'data': {
                'fixture_id': fixture_id,
                'points': points,
                'home_team': match_data.get('home_team', ''),
                'away_team': match_data.get('away_team', ''),
                'home_score': match_data.get('home_score', 0),
                'away_score': match_data.get('away_score', 0)
            },
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        sqs.send_message(
            QueueUrl=NOTIFICATION_QUEUE_URL,
            MessageBody=json.dumps(notification)
        )
    except Exception as e:
        logger.error(f"Error sending notification for user {user_id}: {e}")
        # Don't raise exception for notification failures

def process_match(match: Dict[str, Any]) -> int:
    """Process a single match and update predictions"""
    fixture_id = match['fixture_id']
    home_score = int(match['home_score'])
    away_score = int(match['away_score'])
    
    # Get predictions for this match
    predictions = get_predictions_for_match(fixture_id)
    
    processed_count = 0
    for prediction in predictions:
        try:
            # Calculate points
            points = calculate_points(
                int(prediction['score1']),
                int(prediction['score2']),
                home_score,
                away_score
            )
            
            # Update prediction
            update_prediction(prediction, points)
            
            # Update user results
            update_user_results(
                int(prediction['user_id']),
                prediction['season'],
                int(prediction['week']),
                points
            )
            
            # Send notification
            send_notification(
                int(prediction['user_id']),
                fixture_id,
                points,
                match
            )
            
            processed_count += 1
        except Exception as e:
            logger.error(f"Error processing prediction {prediction['id']}: {e}")
            continue
    
    # Mark match as processed
    mark_match_as_processed(fixture_id)
    
    return processed_count

def lock_upcoming_matches() -> int:
    """Lock predictions for matches that are about to start"""
    try:
        # Get matches starting in the next hour
        now = datetime.now(timezone.utc)
        one_hour_from_now = now + timedelta(hours=1)
        
        response = fixtures_table.scan(
            FilterExpression="#status = :not_started AND #date BETWEEN :now AND :one_hour",
            ExpressionAttributeNames={
                '#status': 'status',
                '#date': 'date'
            },
            ExpressionAttributeValues={
                ':not_started': MatchStatus.NOT_STARTED,
                ':now': now.isoformat(),
                ':one_hour': one_hour_from_now.isoformat()
            }
        )
        
        upcoming_matches = response.get('Items', [])
        locked_count = 0
        
        for match in upcoming_matches:
            fixture_id = match['fixture_id']
            
            # Find all submitted predictions for this match
            pred_response = predictions_table.scan(
                FilterExpression="#fixture_id = :fixture_id AND #status = :submitted_status",
                ExpressionAttributeNames={
                    '#fixture_id': 'fixture_id',
                    '#status': 'prediction_status'
                },
                ExpressionAttributeValues={
                    ':fixture_id': fixture_id,
                    ':submitted_status': PredictionStatus.SUBMITTED
                }
            )
            
            predictions = pred_response.get('Items', [])
            
            # Lock each prediction
            for prediction in predictions:
                try:
                    predictions_table.update_item(
                        Key={
                            'id': prediction['id']
                        },
                        UpdateExpression="SET #status = :locked_status",
                        ExpressionAttributeNames={
                            '#status': 'prediction_status'
                        },
                        ExpressionAttributeValues={
                            ':locked_status': PredictionStatus.LOCKED
                        }
                    )
                    locked_count += 1
                except Exception as e:
                    logger.error(f"Error locking prediction {prediction['id']}: {e}")
                    continue
        
        return locked_count
    except Exception as e:
        logger.error(f"Error locking upcoming matches: {e}")
        return 0

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Main Lambda handler"""
    try:
        action = event.get('action')
        
        if not action and event.get('body'):
            # Try to parse from request body
            body = json.loads(event['body'])
            action = body.get('action')
        
        if not action:
            # Default to process_completed_matches
            action = 'process_completed_matches'
        
        if action == 'process_completed_matches':
            # Get completed matches
            completed_matches = get_completed_matches()
            
            if not completed_matches:
                return {
                    "statusCode": 200,
                    "body": json.dumps({
                        "message": "No completed matches to process"
                    })
                }
            
            # Process each match
            total_processed = 0
            for match in completed_matches:
                processed = process_match(match)
                total_processed += processed
            
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "message": f"Processed {len(completed_matches)} matches with {total_processed} predictions"
                })
            }
        
        elif action == 'lock_upcoming_matches':
            # Lock predictions for upcoming matches
            locked_count = lock_upcoming_matches()
            
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "message": f"Locked {locked_count} predictions for upcoming matches"
                })
            }
        
        else:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": f"Unsupported action: {action}"
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