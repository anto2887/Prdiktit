import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from ..core.config import settings
from ..core.dependencies import get_current_active_user_from_session
from ..db.session_manager import get_db
from ..db.models import UserNotificationPreferences, User as UserModel
from ..schemas import (
    DataResponse,
    User,
    NotificationPreferences,
    NotificationPreferencesUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/preferences", response_model=DataResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db),
):
    """
    Get the current user's notification preferences.
    If no row exists yet, creates a default row and returns it.
    """
    prefs = (
        db.query(UserNotificationPreferences)
        .filter_by(user_id=current_user.id)
        .first()
    )

    if not prefs:
        prefs = UserNotificationPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)

    return DataResponse(
        status="success",
        message="Notification preferences retrieved",
        data=NotificationPreferences.from_attributes(prefs),
    )


@router.put("/preferences", response_model=DataResponse)
async def update_notification_preferences(
    update: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db),
):
    """
    Update the current user's notification preferences.
    Supports partial updates – only provided fields are changed.
    """
    prefs = (
        db.query(UserNotificationPreferences)
        .filter_by(user_id=current_user.id)
        .first()
    )

    if not prefs:
        prefs = UserNotificationPreferences(user_id=current_user.id)
        db.add(prefs)

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(prefs, field, value)

    prefs.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(prefs)

    return DataResponse(
        status="success",
        message="Notification preferences updated",
        data=NotificationPreferences.from_attributes(prefs),
    )


@router.get("/unsubscribe/{token}", response_class=HTMLResponse)
async def unsubscribe_from_notification(token: str, db: Session = Depends(get_db)):
    """
    One-click unsubscribe endpoint.
    Token is a signed JWT: {"sub": user_id, "pref": "<preference_field>"}.
    No authentication required – link is sent to user's email.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id_str = payload.get("sub")
        pref_field = payload.get("pref")

        if not user_id_str or not pref_field:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid unsubscribe token",
            )

        user_id = int(user_id_str)

        # Ensure the preference field is valid
        allowed_fields = {
            "prediction_reminders",
            "match_result_updates",
            "group_activity",
        }
        if pref_field not in allowed_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid unsubscribe preference",
            )

        # Load user & prefs
        user = db.query(UserModel).filter_by(id=user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        prefs = (
            db.query(UserNotificationPreferences)
            .filter_by(user_id=user_id)
            .first()
        )
        if not prefs:
            prefs = UserNotificationPreferences(user_id=user_id)
            db.add(prefs)

        setattr(prefs, pref_field, False)
        prefs.updated_at = datetime.now(timezone.utc)
        db.commit()

        pref_label_map = {
            "prediction_reminders": "prediction reminders",
            "match_result_updates": "match result updates",
            "group_activity": "group activity notifications",
        }
        label = pref_label_map.get(pref_field, pref_field.replace("_", " "))

        frontend_url = settings.NOTIFICATION_BASE_URL.rstrip("/")
        settings_url = f"{frontend_url}/settings"

        html = f"""
        <html>
          <head><title>Unsubscribed</title></head>
          <body style="font-family: Arial, sans-serif; padding: 24px;">
            <h2>You've been unsubscribed</h2>
            <p>
              You have been unsubscribed from <strong>{label}</strong>.
            </p>
            <p>
              You can manage all your email preferences any time from your
              <a href="{settings_url}">PrediktIt settings</a>.
            </p>
          </body>
        </html>
        """
        return HTMLResponse(content=html, status_code=200)

    except JWTError as e:
        logger.error(f"Invalid unsubscribe token: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid unsubscribe token",
        )

