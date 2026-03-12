import html
from datetime import datetime
from typing import List, Dict, Any

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError  # Python 3.11 stdlib

from ..core.config import settings


def _get_user_timezone(user) -> ZoneInfo:
    """
    Best-effort lookup of user's timezone from settings JSON.
    Falls back to UTC if anything is missing/invalid.
    """
    try:
        tz_name = None
        if getattr(user, "settings", None):
            display_prefs = user.settings.get("displayPreferences") or {}
            tz_name = display_prefs.get("timezone")
        if tz_name:
            return ZoneInfo(tz_name)
    except Exception:
        pass
    return ZoneInfo("UTC")


def _format_kickoff(dt: datetime, user) -> str:
    if not isinstance(dt, datetime):
        return ""
    try:
        user_tz = _get_user_timezone(user)
        local_dt = dt.astimezone(user_tz)
        # Example: Sat 21 Jun 19:30
        return local_dt.strftime("%a %d %b %H:%M")
    except Exception:
        return dt.isoformat()


def _base_footer(unsubscribe_url: str) -> str:
    escaped_url = html.escape(unsubscribe_url, quote=True)
    return f"""
    <tr>
      <td style="padding-top:24px; font-size:12px; color:#9CA3AF; text-align:center;">
        You can manage your email preferences at any time in your PrediktIt settings.
        <br/>
        <a href="{escaped_url}" style="color:#6B7280; text-decoration:underline;">
          Unsubscribe from this type of email
        </a>
      </td>
    </tr>
    """


def build_prediction_reminder(
    matches: List[Any],
    hours_until: int,
    user,
    unsubscribe_token: str,
) -> Dict[str, str]:
    """
    Build prediction reminder email.
    matches: list of Fixture objects (or dicts with similar attrs).
    """
    n = len(matches)
    if hours_until == 24:
        subject = f"⏰ {n} match(es) kick off in 24 hours — predictions close soon"
    else:
        subject = f"⏰ {n} match(es) kick off in 1 hour — last chance to predict"

    rows_html = ""
    for m in matches:
        home = getattr(m, "home_team", None) or getattr(m, "home", "Home")
        away = getattr(m, "away_team", None) or getattr(m, "away", "Away")
        kickoff = getattr(m, "date", None) or getattr(m, "kickoff", None)
        kickoff_str = _format_kickoff(kickoff, user) if kickoff else ""
        # We don't know prediction status here; leave generic
        rows_html += f"""
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #E5E7EB;">
            <div style="font-weight:600; color:#111827;">{html.escape(home)} vs {html.escape(away)}</div>
            <div style="font-size:12px; color:#6B7280;">Kickoff: {html.escape(kickoff_str)} </div>
          </td>
        </tr>
        """

    base_url = settings.NOTIFICATION_BASE_URL.rstrip("/")
    unsubscribe_url = f"{base_url}/api/v1/notifications/unsubscribe/{unsubscribe_token}"

    html_body = f"""
    <div style="background-color:#F3F4F6; padding:24px;">
      <table width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; padding:24px;">
        <tr>
          <td style="font-size:18px; font-weight:700; color:#111827; padding-bottom:8px;">
            PrediktIt — Upcoming Matches
          </td>
        </tr>
        <tr>
          <td style="font-size:14px; color:#4B5563; padding-bottom:16px;">
            Here are your upcoming matches. Make sure you get your predictions in before kickoff.
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellspacing="0" cellpadding="0">
              {rows_html}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:16px;">
            <a href="{html.escape(base_url + '/predictions', quote=True)}"
               style="display:inline-block; background-color:#2563EB; color:#ffffff; padding:10px 20px; border-radius:9999px; text-decoration:none; font-weight:600; font-size:14px;">
              Make Your Predictions
            </a>
          </td>
        </tr>
        {_base_footer(unsubscribe_url)}
      </table>
    </div>
    """

    text_body_lines = [
        "PrediktIt — Upcoming Matches",
        "",
        "Here are your upcoming matches:",
    ]
    for m in matches:
        home = getattr(m, "home_team", None) or getattr(m, "home", "Home")
        away = getattr(m, "away_team", None) or getattr(m, "away", "Away")
        kickoff = getattr(m, "date", None) or getattr(m, "kickoff", None)
        kickoff_str = _format_kickoff(kickoff, user) if kickoff else ""
        text_body_lines.append(f"- {home} vs {away} — Kickoff: {kickoff_str}")

    text_body_lines.append("")
    text_body_lines.append(f"Make your predictions: {base_url}/predictions")
    text_body_lines.append(f"Unsubscribe from prediction reminders: {unsubscribe_url}")

    return {
        "subject": subject,
        "html": html_body,
        "text": "\n".join(text_body_lines),
    }


def build_match_result(
    fixture,
    user_prediction,
    points_earned: int,
    user,
    unsubscribe_token: str,
) -> Dict[str, str]:
    home = getattr(fixture, "home_team", "Home")
    away = getattr(fixture, "away_team", "Away")
    hs = getattr(fixture, "home_score", 0) or 0
    as_ = getattr(fixture, "away_score", 0) or 0

    subject = f"📊 Result: {home} {hs}–{as_} {away} — {points_earned} pts earned"

    pred_h = getattr(user_prediction, "score1", 0) or 0
    pred_a = getattr(user_prediction, "score2", 0) or 0

    base_url = settings.NOTIFICATION_BASE_URL.rstrip("/")
    unsubscribe_url = f"{base_url}/api/v1/notifications/unsubscribe/{unsubscribe_token}"

    html_body = f"""
    <div style="background-color:#F3F4F6; padding:24px;">
      <table width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; padding:24px;">
        <tr>
          <td style="font-size:18px; font-weight:700; color:#111827; padding-bottom:8px;">
            Full Time Result
          </td>
        </tr>
        <tr>
          <td style="font-size:16px; font-weight:600; color:#111827; padding-bottom:4px;">
            {html.escape(home)} {hs}–{as_} {html.escape(away)}
          </td>
        </tr>
        <tr>
          <td style="font-size:14px; color:#4B5563; padding-bottom:12px;">
            Your prediction: {pred_h}–{pred_a}
          </td>
        </tr>
        <tr>
          <td style="font-size:14px; color:#111827; padding-bottom:8px; font-weight:600;">
            Points earned: {points_earned}
          </td>
        </tr>
        <tr>
          <td style="font-size:12px; color:#6B7280; padding-bottom:16px;">
            Scoring: correct result = 1pt · exact score = 3pts · wrong = 0pts
          </td>
        </tr>
        <tr>
          <td align="center">
            <a href="{html.escape(base_url + '/predictions/history', quote=True)}"
               style="display:inline-block; background-color:#2563EB; color:#ffffff; padding:10px 20px; border-radius:9999px; text-decoration:none; font-weight:600; font-size:14px;">
              View Full Results
            </a>
          </td>
        </tr>
        {_base_footer(unsubscribe_url)}
      </table>
    </div>
    """

    text_body = (
        "Full Time Result\n\n"
        f"{home} {hs}–{as_} {away}\n"
        f"Your prediction: {pred_h}–{pred_a}\n"
        f"Points earned: {points_earned}\n\n"
        "Scoring: correct result = 1pt · exact score = 3pts · wrong = 0pts\n\n"
        f"View full results: {base_url}/predictions/history\n"
        f"Unsubscribe from match result updates: {unsubscribe_url}\n"
    )

    return {
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }


def build_group_activity(
    event_type: str,
    group,
    actor_username: str,
    recipient,
    unsubscribe_token: str,
) -> Dict[str, str]:
    group_name = getattr(group, "name", "your group")
    group_id = getattr(group, "id", None)
    base_url = settings.NOTIFICATION_BASE_URL.rstrip("/")

    if event_type == "member_joined":
        subject = f"👋 {actor_username} joined {group_name}"
        body = (
            f"{actor_username} just joined your group {group_name}.\n\n"
            "Jump back in to see how the table is shaping up."
        )
        cta_url = f"{base_url}/groups/{group_id}" if group_id else f"{base_url}/groups"
        cta_label = "View Group"
    elif event_type == "rivalry_assigned":
        subject = f"⚔️ Your rivalry week opponent is {actor_username}"
        body = (
            f"This week in {group_name} you're up against {actor_username}.\n"
            "May the best predictor win."
        )
        cta_url = (
            f"{base_url}/groups/{group_id}/rivalries"
            if group_id
            else f"{base_url}/groups"
        )
        cta_label = "View Rivalries"
    else:
        subject = f"Group activity in {group_name}"
        body = f"There's new activity in your group {group_name}."
        cta_url = f"{base_url}/groups/{group_id}" if group_id else f"{base_url}/groups"
        cta_label = "View Group"

    unsubscribe_url = f"{base_url}/api/v1/notifications/unsubscribe/{unsubscribe_token}"

    html_body = f"""
    <div style="background-color:#F3F4F6; padding:24px;">
      <table width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; padding:24px;">
        <tr>
          <td style="font-size:18px; font-weight:700; color:#111827; padding-bottom:8px;">
            Group Activity
          </td>
        </tr>
        <tr>
          <td style="font-size:14px; color:#4B5563; padding-bottom:16px; white-space:pre-line;">
            {html.escape(body)}
          </td>
        </tr>
        <tr>
          <td align="center">
            <a href="{html.escape(cta_url, quote=True)}"
               style="display:inline-block; background-color:#2563EB; color:#ffffff; padding:10px 20px; border-radius:9999px; text-decoration:none; font-weight:600; font-size:14px;">
              {html.escape(cta_label)}
            </a>
          </td>
        </tr>
        {_base_footer(unsubscribe_url)}
      </table>
    </div>
    """

    text_body = (
        "Group Activity\n\n"
        f"{body}\n\n"
        f"{cta_label}: {cta_url}\n"
        f"Unsubscribe from group activity emails: {unsubscribe_url}\n"
    )

    return {
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }

