"""One-time Google Calendar OAuth setup.

Run once to obtain a refresh_token that the backend uses to create Meet
invites on your behalf.

Usage
-----
1. In Google Cloud Console:
     - Create / select a project.
     - APIs & Services -> Library -> enable "Google Calendar API".
     - OAuth consent screen -> External; add your Google account as a
       test user.
     - Credentials -> Create OAuth client ID -> "Desktop app".
     - Copy the Client ID and Client Secret.

2. Export them (or paste into backend/.env) and run:

       cd backend
       export GOOGLE_CLIENT_ID=...
       export GOOGLE_CLIENT_SECRET=...
       .venv/bin/python scripts/gcal_oauth_setup.py

3. A browser window opens. Approve the consent screen with your Google
   account (this is the account that will create the events and send the
   invites).

4. The script prints three lines:

       GOOGLE_CLIENT_ID=...
       GOOGLE_CLIENT_SECRET=...
       GOOGLE_REFRESH_TOKEN=...
       GOOGLE_ORGANIZER_EMAIL=you@example.com

   Paste them into backend/.env and restart the uvicorn server.
"""
from __future__ import annotations

import os
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]


def main() -> int:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        print(
            "ERROR: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first "
            "(env vars or backend/.env).",
            file=sys.stderr,
        )
        return 1

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": ["http://localhost"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    # `access_type=offline` + `prompt=consent` is required to get a
    # refresh_token back reliably.
    creds = flow.run_local_server(
        port=0,
        access_type="offline",
        prompt="consent",
        open_browser=True,
    )

    if not creds.refresh_token:
        print("ERROR: no refresh_token returned. Retry with prompt=consent.", file=sys.stderr)
        return 2

    email = ""
    if creds.id_token:
        try:
            import base64
            import json

            payload = creds.id_token.split(".")[1]
            payload += "=" * (-len(payload) % 4)
            email = json.loads(base64.urlsafe_b64decode(payload)).get("email", "")
        except Exception:
            pass

    print("\n=== Paste these into backend/.env ===")
    print(f"GOOGLE_CLIENT_ID={client_id}")
    print(f"GOOGLE_CLIENT_SECRET={client_secret}")
    print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
    if email:
        print(f"GOOGLE_ORGANIZER_EMAIL={email}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
