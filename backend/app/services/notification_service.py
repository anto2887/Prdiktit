import logging
from datetime import timedelta
from typing import Optional, List, Any

from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import create_access_token
from ..db.models import (
    User,
    Group,
    UserNotificationPreferences,
)
from ..db.repository import get_group_members
from .email_templates import (
    build_prediction_reminder,
    build_match_result,
    build_match_result_digest,
    build_group_activity,
)

logger = logging.getLogger(__name__)


class EmailService:
    """
    Low-level email sender. Provider-agnostic.
    Switch provider by changing EMAIL_PROVIDER env var — no code change needed.
    """

    def __init__(self) -> None:
        self.provider = settings.EMAIL_PROVIDER

    async def send(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html: str,
        text: str,
    ) -> bool:
        try:
            if self.provider == "sendgrid":
                return await self._send_sendgrid(
                    to_email, to_name, subject, html, text
                )
            elif self.provider == "mailgun":
                return await self._send_mailgun(
                    to_email, to_name, subject, html, text
                )
            else:
                logger.error(f"Unknown email provider: {self.provider}")
                return False
        except Exception as e:
            logger.error(f"Email send failed to {to_email}: {e}")
            return False

    async def _send_sendgrid(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html: str,
        text: str,
    ) -> bool:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, To, From, Content

        message = Mail(
            from_email=From(
                settings.SENDGRID_FROM_EMAIL, settings.SENDGRID_FROM_NAME
            ),
            to_emails=To(to_email, to_name),
            subject=subject,
            html_content=Content("text/html", html),
            plain_text_content=Content("text/plain", text),
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        success = response.status_code in (200, 201, 202)
        if not success:
            logger.error(
                f"SendGrid returned {response.status_code}: {response.body}"
            )
        return success

    async def _send_mailgun(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html: str,
        text: str,
    ) -> bool:
        import requests as req

        if not settings.MAILGUN_DOMAIN or not settings.MAILGUN_API_KEY:
            logger.error("Mailgun configuration missing; cannot send email")
            return False

        response = req.post(
            f"https://api.mailgun.net/v3/{settings.MAILGUN_DOMAIN}/messages",
            auth=("api", settings.MAILGUN_API_KEY),
            data={
                "from": f"{settings.SENDGRID_FROM_NAME} <{settings.SENDGRID_FROM_EMAIL}>",
                "to": f"{to_name} <{to_email}>",
                "subject": subject,
                "html": html,
                "text": text,
            },
        )
        if response.status_code != 200:
            logger.error(
                f"Mailgun returned {response.status_code}: {response.text}"
            )
        return response.status_code == 200


class NotificationService:
    """
    High-level notification methods. Checks user preferences before every send.
    Called by routers (group join, rivalry) and the notification scheduler.
    """

    def __init__(self, db: Session):
        self.db = db
        self.email = EmailService()

    def _get_prefs(
        self,
        user_id: int,
    ) -> Optional[UserNotificationPreferences]:
        """Returns prefs row, or None if master email switch is off or row missing."""
        prefs = (
            self.db.query(UserNotificationPreferences)
            .filter_by(user_id=user_id)
            .first()
        )
        if not prefs or not prefs.email_enabled:
            return None
        return prefs

    def _unsubscribe_token(self, user_id: int, pref: str) -> str:
        """Signed JWT for one-click unsubscribe. 30-day expiry."""
        return create_access_token(
            subject=str(user_id),
            expires_delta=timedelta(days=30),
            extra_claims={"pref": pref},
        )

    async def send_prediction_reminder(
        self,
        user_id: int,
        matches: List[Any],
        hours_until: int,
        league_name: Optional[str] = None,
        group_names: Optional[List[str]] = None,
    ) -> bool:
        prefs = self._get_prefs(user_id)
        if not prefs or not prefs.prediction_reminders:
            return False
        if hours_until == 24 and not prefs.reminder_24h:
            return False
        if hours_until == 1 and not prefs.reminder_1h:
            return False

        user = self.db.query(User).filter_by(id=user_id).first()
        if not user or not user.email:
            return False

        token = self._unsubscribe_token(user_id, "prediction_reminders")
        template = build_prediction_reminder(
            matches,
            hours_until,
            user,
            token,
            league_name=league_name,
            group_names=group_names or [],
        )
        return await self.email.send(
            user.email, user.username, template["subject"], template["html"], template["text"]
        )

    async def send_match_result(
        self,
        user_id: int,
        fixture,
        prediction,
        points: int,
    ) -> bool:
        prefs = self._get_prefs(user_id)
        if not prefs or not prefs.match_result_updates:
            return False

        user = self.db.query(User).filter_by(id=user_id).first()
        if not user or not user.email:
            return False

        token = self._unsubscribe_token(user_id, "match_result_updates")
        template = build_match_result(fixture, prediction, points, user, token)
        return await self.email.send(
            user.email, user.username, template["subject"], template["html"], template["text"]
        )

    async def send_match_result_digest(
        self,
        user_id: int,
        entries: List[Any],
        league_name: Optional[str] = None,
        group_names: Optional[List[str]] = None,
    ) -> bool:
        prefs = self._get_prefs(user_id)
        if not prefs or not prefs.match_result_updates:
            return False

        user = self.db.query(User).filter_by(id=user_id).first()
        if not user or not user.email:
            return False

        token = self._unsubscribe_token(user_id, "match_result_updates")
        template = build_match_result_digest(
            entries,
            user,
            token,
            league_name=league_name,
            group_names=group_names or [],
        )
        return await self.email.send(
            user.email, user.username, template["subject"], template["html"], template["text"]
        )

    async def notify_group_join(self, group_id: int, new_member) -> None:
        """Notify admin + all members with group_activity enabled."""
        group = self.db.query(Group).filter_by(id=group_id).first()
        if not group:
            return

        members = await get_group_members(self.db, group_id)
        for member in members:
            # Don't notify the person who just joined
            if member["user_id"] == new_member.id:
                continue

            prefs = self._get_prefs(member["user_id"])
            if not prefs or not prefs.group_activity:
                continue

            user = (
                self.db.query(User).filter_by(id=member["user_id"]).first()
            )
            if not user or not user.email:
                continue

            token = self._unsubscribe_token(member["user_id"], "group_activity")
            template = build_group_activity(
                "member_joined", group, new_member.username, user, token
            )
            await self.email.send(
                user.email,
                user.username,
                template["subject"],
                template["html"],
                template["text"],
            )

    async def notify_rivalry_assigned(self, rivalry_pair, group) -> None:
        """Notify both users in a rivalry pair."""
        pairs = [
            (rivalry_pair.user1_id, rivalry_pair.user2_id),
            (rivalry_pair.user2_id, rivalry_pair.user1_id),
        ]
        for user_id, opponent_id in pairs:
            prefs = self._get_prefs(user_id)
            if not prefs or not prefs.group_activity:
                continue

            user = self.db.query(User).filter_by(id=user_id).first()
            opponent = self.db.query(User).filter_by(id=opponent_id).first()
            if not user or not user.email or not opponent:
                continue

            token = self._unsubscribe_token(user_id, "group_activity")
            template = build_group_activity(
                "rivalry_assigned", group, opponent.username, user, token
            )
            await self.email.send(
                user.email,
                user.username,
                template["subject"],
                template["html"],
                template["text"],
            )

