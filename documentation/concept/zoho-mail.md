# Zoho Mail Booking Notification

## Goal

Send an operational email to `booking@asiatravelplan.com` whenever a public website booking is created.

This is separate from the generated-offer Gmail draft flow:
- Gmail is still used to create editable generated-offer drafts for staff
- Zoho Mail is used for automatic booking notification delivery

Notification failures are logged and do not fail the customer booking submission.

## Configuration

Default ATP Zoho Mail API settings:

```bash
ZOHO_ACCOUNTS_BASE_URL=https://accounts.zoho.com
ZOHO_MAIL_API_BASE_URL=https://mail.zoho.com
ZOHO_CLIENT_ID=1000.YWWEP9YOU6NCNE4JBBRXEIK61NBCJC
ZOHO_CLIENT_SECRET=<Zoho client secret>
ZOHO_REFRESH_TOKEN=<Zoho refresh token>
ZOHO_ACCOUNT_ID=3042681000000008002
WEB_INQUIRY_NOTIFICATION_ENABLED=true
WEB_INQUIRY_NOTIFICATION_FROM=noreply@asiatravelplan.com
WEB_INQUIRY_NOTIFICATION_TO=booking@asiatravelplan.com
WEB_INQUIRY_NOTIFICATION_BACKEND_BASE_URL=https://asiatravelplan.com
WEB_INQUIRY_NOTIFICATION_LOGO_URL=https://asiatravelplan.com/assets/generated/runtime/brand-logo.png
```

Use the accounts and mail API base URLs for the Zoho data center that owns the mailbox.
The logo URL points to the generated runtime brand logo, which is prepared separately for local, staging, and production deploys.

Zoho reference:
- [Zoho Mail Send an Email API](https://www.zoho.com/mail/help/api/post-send-an-email.html)
- [Zoho Mail OAuth 2.0 User Guide](https://www.zoho.com/mail/help/api/using-oauth-2.html)

## Flow

1. The website posts a booking to `POST /public/v1/bookings`.
2. The backend stores the booking and immutable `web_form_submission` snapshot.
3. The backend exchanges `ZOHO_REFRESH_TOKEN` for a short-lived access token.
4. The backend sends a Zoho Mail API email to `WEB_INQUIRY_NOTIFICATION_TO`.
5. If Zoho Mail API credentials are missing or the API is unavailable, the booking remains created and the backend logs the skipped notification.

Important files:
- `backend/app/src/lib/booking_notification_email.js`
- `backend/app/src/lib/zoho_mail_api.js`
- `backend/app/src/http/handlers/bookings.js`
