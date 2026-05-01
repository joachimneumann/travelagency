# Kommo Instagram Integration

Date: 2026-04-29

## Goal

Connect an Instagram business account to Kommo so ATP staff can manage Instagram conversations inside Kommo instead of replying from the Instagram app.

This document covers the current Kommo integration paths for Instagram and explains which path should be used depending on the intended features.

## Starting Point

This setup assumes ATP already has:
- a Meta / Facebook business account or business portfolio
- access to the correct Facebook business Page
- a company-controlled phone number that can receive SMS

The company phone number should be used for the Instagram business account whenever possible, especially for SMS verification and recovery. Avoid using a staff member's private phone number for the business Instagram account unless there is no better option.

The private Facebook account of the owner or admin is still relevant, but only as the login identity that manages the business assets. It should not become the public-facing business presence. The public-facing assets should be:
- the Facebook Page
- the Instagram Business account
- the Kommo channel connected to that Instagram account

Meta Business Suite can be opened at:
- `https://business.facebook.com/`

## Full Setup From The Beginning

Use this sequence when ATP is setting up Instagram for the business for the first time.

### 1. Confirm Meta business access

In Meta Business Suite:
- open `https://business.facebook.com/`
- log in with the Facebook account that has admin access
- confirm the correct business portfolio is selected
- confirm the correct Facebook Page is visible
- confirm the person doing setup has access to manage that Page

If the correct Page is not visible:
- switch to the correct business portfolio
- ask an existing business admin to grant access
- do not continue with Kommo until the correct Page access is clear

### 2. Confirm the company-controlled verification channels

Before creating or connecting Instagram, confirm ATP can receive:
- SMS on the company phone number
- email at the email address used for the Instagram or Facebook admin flow

Recommended:
- use the company phone number for Instagram phone verification and recovery
- use a company-controlled email address for the Instagram account login where possible
- keep the Facebook admin's email verified in Meta Accounts Center

WhatsApp verification note:
- do not create a WhatsApp Business account only to receive an Instagram verification message
- if Instagram offers WhatsApp verification, the company number only needs to be active in WhatsApp for that message to arrive
- create WhatsApp Business only if ATP intends to use that number as a real customer-facing WhatsApp business channel
- remember that one phone number should be treated as one business messaging asset, so avoid switching it casually between personal WhatsApp, WhatsApp Business, and later platform integrations

### 3. Create the business Instagram account

Recommended device:
- use the Instagram mobile app on a phone, ideally the phone or SIM that can receive SMS for the company number

Reason:
- SMS verification is easier to complete on the phone
- Instagram's professional account setup is usually smoother in the mobile app
- account security checks are easier to handle when the verification phone is available during setup

Creating the account from a computer is possible, but keep the company phone nearby for SMS verification and expect to finish some business-account settings in the Instagram mobile app if the desktop flow does not show every option.

In Instagram:
- install/open Instagram
- create a new account for the business, or use the existing business account if one already exists
- choose a business handle that matches the brand as closely as possible
- add the company phone number when Instagram asks for phone verification
- complete SMS verification
- add the business email address if Instagram asks for contact or recovery details

Do not use the owner's private Instagram profile unless ATP intentionally wants to convert that profile into the business account.

### 4. Switch Instagram to a professional Business account

In Instagram:
- open the business profile
- open the menu
- go to account type / professional account settings
- switch to a professional account
- choose `Business` rather than `Creator`
- select the closest business category
- add public business contact details if desired

Recommended outcome:
- the Instagram account is an Instagram Business account
- the account phone number is verified
- the account can receive login and security checks

### 5. Confirm or create the Facebook Page

In Facebook or Meta Business Suite:
- confirm ATP has the correct Facebook Page for the business
- if no Page exists, create the Facebook Page before continuing
- confirm the Page belongs to or is accessible from the correct business portfolio
- confirm the setup user has Page access

The Page is needed for the recommended Facebook-linked Kommo path.

### 6. Link Instagram to the Facebook Page

Before starting the Kommo connection:
- connect the Instagram Business account to the Facebook Page

This can be done from either side:
- Facebook Page settings: linked accounts / Instagram
- Instagram profile settings: public business information / Page

Recommended outcome:
- the Facebook Page and Instagram Business account are visibly connected
- the person doing setup can access both assets

### 7. Add or confirm Instagram in the Meta business portfolio

In Meta Business Suite:
- open `Settings`
- open the business assets / accounts area
- confirm the Instagram account is visible under Instagram accounts or business assets
- if it is missing, add/connect it using the Instagram account login

This keeps the Facebook Page, Instagram account, and Kommo authorization aligned under the same business ownership model.

### 8. Connect Instagram to Kommo

In Kommo:
- open `Settings`
- open `Integrations`
- open `Instagram`
- use `Continue with Facebook` for the recommended production path
- authorize with the Facebook account that has access to the correct business portfolio, Page, and Instagram account
- select the correct business, Page, and Instagram account
- enable the Instagram tools ATP needs, such as messages, comments, stories, and mentions

After setup:
- test an inbound Instagram DM from another account
- reply from Kommo
- confirm the reply appears in Instagram
- test comments or story mentions if ATP wants those features

## Supported Connection Paths

Kommo currently supports two connection methods:
- direct Instagram login
- Facebook-linked Instagram connection

## Recommended Path

For production use, the recommended path is:
- connect Instagram to Kommo via Facebook

Reason:
- it is the more complete business setup
- it aligns better with Meta's Page and Inbox model
- it is the safer route if comments, story mentions, and other Meta-connected business tools are needed

Use direct Instagram login only if:
- the goal is a simpler setup
- no Facebook Business Page is being used
- the business mainly needs Instagram messaging and does not depend on the broader Facebook-linked setup

This recommendation is based on Kommo's current setup guides and feature notes.

## Preconditions

Before starting, confirm:
- the Instagram account is intended for business communication
- the Instagram account is switched to a professional account, ideally a Business account
- the Instagram account credentials are available
- if using the Facebook path, the correct Facebook Page exists
- if using the Facebook path, the Instagram account is linked to that Facebook Page
- if using the Facebook path, the person doing the setup has access to the correct Facebook Page
- the Kommo account is available and the user can access integrations
- the Instagram account has a verified phone number, because Kommo notes this can be required during authorization

## Important Constraint

If ATP staff reply directly from the Instagram app instead of from Kommo:
- those replies may not be reflected correctly in Kommo's conversation history

Operational rule:
- once connected, customer-facing replies should be sent from Kommo whenever the business wants the CRM timeline to remain complete

## When To Use Which Path

### Use the Facebook-linked path when:

- the business uses a Facebook Page together with Instagram
- comments and story mentions matter
- Meta-side business tooling should remain available
- the setup should follow the more standard business route

### Use the direct Instagram login path when:

- the business wants the fastest setup
- no Facebook Page is required
- the account is already an Instagram Business account
- the main need is Instagram messaging in Kommo

## Path A: Facebook-Linked Instagram Connection

### 1. Confirm the Instagram account type

In Instagram:
- confirm the account is a professional account
- ideally use an Instagram Business account

If the account is personal:
- Meta or Kommo may ask to switch it during setup

### 2. Confirm the correct Facebook Page

In Facebook:
- confirm the Page that should be connected to the Instagram account
- confirm the person doing the setup has access to that Page

### 3. Link the Instagram account to the Facebook Page

Before starting in Kommo:
- connect the Instagram professional account to the Facebook Page

This can be done either:
- from Facebook Page settings under linked accounts
- or from Instagram professional account settings by assigning the Page

Recommended outcome:
- the Instagram business account and Facebook Page are already connected before Kommo setup begins

### 4. Start the setup in Kommo

In Kommo:
- open `Settings`
- open `Integrations`
- open `Instagram`
- click `Continue with Facebook`

### 5. Log into Facebook with the correct account

In the Facebook popup:
- log in with the same Facebook account used for the connected business assets

Kommo's current documentation specifically notes:
- use the same Facebook account as other Kommo Meta integrations if those already exist
- ensure that the Facebook account has a verified email address

### 6. Start the Meta authorization flow

In the Facebook flow:
- click `Continue as ...`
- click `Get started`
- click `Log in` if prompted

### 7. Select the Facebook Page

In the Meta flow:
- select the Facebook Page to associate with the Instagram account

If the Page and Instagram account are already connected:
- this step may be skipped

### 8. Enable message access

In the Meta flow:
- enable message access when prompted
- click `Next`

This is important because Instagram messaging access is part of what Kommo needs to manage conversations.

### 9. Select the business, Pages, and Instagram account

In the Meta permissions flow:
- select the relevant business
- select the relevant Facebook Page
- select the relevant Instagram account
- continue through the selection steps

If Meta offers access to:
- current and future businesses
- current and future pages
- current and future Instagram accounts

Prefer the narrowest safe choice for production unless broader future access is intentionally desired.

### 10. Review and save permissions

In the Meta flow:
- review the permissions Kommo requests
- click `Save`

Then:
- click `Got it` to return to Kommo

### 11. Enable the Instagram tools inside Kommo

After returning to Kommo:
- use the `+ Add page` or equivalent integration controls
- select the tools that should be enabled for the connected Instagram account

Typical tools include:
- Instagram messages
- stories and mentions
- comments

## Path B: Direct Instagram Login

### 1. Confirm the Instagram account type

In Instagram:
- confirm the account is an Instagram Business account

Kommo's direct-login flow specifically expects:
- an Instagram Business account

### 2. Start the setup in Kommo

In Kommo:
- open `Settings`
- open `Integrations`
- open `Instagram`
- click `Continue with Instagram`

### 3. Log into Instagram

In the Instagram authentication flow:
- log in with the Instagram Business account credentials
- complete the authentication steps
- confirm the connection

### 4. Return to Kommo and confirm status

After authentication:
- return to Kommo
- confirm that the integration status becomes active

### 5. Manage connected accounts

After connecting:
- additional Instagram accounts can be added through the integration widget
- accounts can be switched or removed as needed

## Post-Connection Tasks In Kommo

### 12. Confirm the integration is active

In Kommo:
- confirm the Instagram integration status is active
- confirm the correct Instagram account is attached

### 13. Check pipeline routing

If ATP wants Instagram conversations to appear in a specific pipeline:
- confirm the connected Instagram account is attached to the intended pipeline configuration

This matters especially if:
- different channels are separated by pipeline

### 14. Test inbound messaging

From a separate Instagram account:
- send a direct message to the business account
- confirm the message appears in Kommo
- reply from Kommo
- confirm the reply is received in Instagram

### 15. Test comments or story mentions if those are required

If the business wants comments or mention handling:
- post a test comment on a post
- mention the business account in a Story
- confirm that Kommo receives the event in the correct channel configuration

### 16. Decide the staff operating rule

Recommended operating rule:
- staff should reply from Kommo instead of from the Instagram app when the conversation must remain fully tracked in CRM

## Messaging Limitations To Keep In Mind

Kommo's current Instagram integration notes these limitations:
- if a client messaged more than 24 hours ago, the reply window becomes restricted
- between 1 and 7 days after the client's last message, Kommo can rely on the `human_agent` tag
- after 7 days, replies are no longer available through the supported Instagram messaging flow

Supported content is limited. Kommo currently notes support for:
- text messages
- certain image formats under size limits
- limited stickers
- limited reactions
- Instagram image and video shares

Story mentions are supported, but:
- Stories are only viewable for 24 hours or until deleted by the author

## Feature Notes

Useful current capabilities in Kommo include:
- Instagram direct messages
- comments handling
- story mentions
- quick-reply buttons through Salesbot

Additional business feature note:
- Kommo's overview notes that some Instagram marketing and mentions automation features require the Instagram Business Account to be linked to Facebook

## Common Failure Cases

### Authorization fails in Kommo

Likely causes:
- the Instagram account is not a Business account
- the Instagram account phone number is not verified
- the wrong Facebook account is being used

Action:
- confirm the account type
- confirm phone verification in Instagram
- confirm the correct Facebook identity is being used

### Instagram or Meta says SMS cannot be sent right now

Possible message:
- `We can't send the SMS to this number right now`

Likely causes:
- Meta/Instagram has temporarily rate-limited SMS attempts for that number
- the number format or country code is wrong
- the phone number is not a normal SMS-capable mobile number
- the carrier is blocking short-code or automated verification messages
- too many verification attempts were made in a short period
- the number was recently added, ported, reused, or flagged by Meta's security checks

Action:
- stop requesting SMS codes for a while instead of retrying repeatedly
- wait and try again later, preferably after several hours or the next day
- confirm the number is entered with the correct country code
- confirm the company phone can receive normal SMS and short-code / automated SMS
- check blocked numbers, spam filters, and filtered SMS folders on the phone
- try email verification instead if Meta offers it
- try WhatsApp verification if Meta offers it and the number has WhatsApp
- if the number keeps failing, use another company-controlled mobile number

Do not switch to a staff member's private number unless it is a temporary emergency. If a private number must be used temporarily, replace it with a company-controlled number after the account is stable.

### Facebook path does not show the correct Page or Instagram account

Likely causes:
- the Instagram account is not properly linked to the Page
- the person doing setup does not have Page access

Action:
- reconnect the Page and Instagram account first
- verify Page access before repeating Kommo setup

### Messages appear in Instagram but the full history is incomplete in Kommo

Likely cause:
- staff replied directly in Instagram instead of Kommo

Action:
- move the operational reply flow into Kommo
- treat Instagram app replies as an exception, not the standard workflow

### Comments or mentions are missing

Likely causes:
- the account was connected with the simpler direct login path
- the required tools were not enabled after the Facebook-linked setup
- the Instagram account is not linked to Facebook as needed for those features

Action:
- prefer the Facebook-linked setup
- verify that stories, mentions, and comments tools are enabled in Kommo

### Wrong business assets were authorized

Likely cause:
- the wrong Facebook account or business assets were selected during authorization

Action:
- disconnect the integration
- repeat the setup with the correct Facebook account, Page, and Instagram account

## Explicit Non-Goals

This document does not cover:
- Instagram advertising strategy
- Meta ad account setup
- Instagram content planning
- advanced Salesbot design
- custom API development outside Kommo

## Recommended Operational Checklist

Use this order during the real setup session:

1. Decide whether the business needs the Facebook-linked path or only the direct Instagram login path.
2. Confirm the Instagram account is a professional account, ideally Business.
3. Confirm the Instagram account phone number is verified.
4. If using Facebook, confirm the correct Facebook Page and Page access.
5. If using Facebook, connect the Instagram account to the Facebook Page before entering Kommo.
6. Open `Settings > Integrations > Instagram` in Kommo.
7. Start either `Continue with Facebook` or `Continue with Instagram`.
8. Complete the authorization flow with the correct account.
9. Return to Kommo and confirm the integration is active.
10. If using Facebook, enable the specific Instagram tools needed in Kommo.
11. Test inbound direct messages.
12. If needed, test comments and story mentions.
13. Instruct staff to reply from Kommo, not from the Instagram app, for tracked conversations.

## References

- [Kommo: Connect Instagram to Kommo](https://www.kommo.com/support/kb/instagram/)
- [Kommo: Instagram overview](https://www.kommo.com/support/kb/instagram-overview/)
- [Kommo: Messenger-based sales FAQs](https://www.kommo.com/support/getting-started/messenger-faqs/)
- [Meta: Connect or disconnect an Instagram account and your Page](https://www.facebook.com/help/www/1148909221857370)
- [Meta: About connecting your professional Instagram account to a Facebook Page](https://www.facebook.com/help/instagram/790156881117411/)
- [Meta: Add or change the Facebook Page connected to your Instagram professional account](https://www.facebook.com/help/570895513091465)
