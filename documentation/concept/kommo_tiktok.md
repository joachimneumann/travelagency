# Kommo TikTok Integration

Date: 2026-04-29

## Goal

Connect a TikTok Business Account to Kommo so ATP staff can manage TikTok conversations inside Kommo, capture leads automatically, and use Kommo automation features for TikTok-originated chats.

This document covers the current Kommo setup flow for TikTok and the operational limits that matter after the connection is live.

## Recommended Path

TikTok has a single main connection flow in Kommo:
- prepare the TikTok account in the TikTok app
- then authorize it from Kommo using `Continue with TikTok`

Unlike the Instagram setup, there is no separate Facebook-linked route here.

## Preconditions

Before starting, confirm:
- the TikTok account is meant for business communication
- the TikTok account is switched to a Business Account
- the TikTok Business Account was created in a Kommo-supported region
- the TikTok account can receive direct messages from the audience segments required by Kommo
- the Kommo account is available and the user can access integrations
- no other TikTok account is already connected to this Kommo account

## Important Constraints

Kommo's current TikTok integration has several practical limits:
- only one TikTok account can be connected per Kommo account
- users from Europe, Switzerland, and the UK cannot be messaged through this Kommo integration
- buttons and videos are not supported in regular TikTok messaging
- the supported message types are limited
- messaging volume is restricted by TikTok's reply window

Operational rule:
- after connecting, ATP staff should reply from Kommo when the conversation should be preserved in CRM

## Regional Requirement

Kommo's current documentation says the TikTok Business Account must be signed up in one of its supported regions, which currently include:
- Asia-Pacific
- METAP
- Latin America
- North America

If the TikTok account was created outside those supported regions, the Kommo integration may not be usable.

## Setup Steps

### Step 1: Switch the TikTok account to a Business Account

In the TikTok app:
- open `Profile`
- open `Settings and privacy`
- open `Account`
- choose `Switch to Business Account`

Recommended outcome:
- the account is clearly configured as a TikTok Business Account before the Kommo authorization begins

### Step 2: Enable direct messages from the required audiences

In the TikTok app:
- go to `Profile`
- open `Settings and privacy`
- open `Privacy`
- open `Permission settings` or the current direct message privacy section

Then set message requests so Kommo can receive inbound conversations. Kommo's current setup guide specifically says to allow message requests for:
- `Potential Connections`
- `Other on TikTok`

Recommended setting:
- receive messages as requests for both of those groups

This is one of the most important setup steps. If it is skipped, Kommo may connect successfully but not receive the conversations expected by the business.

### Step 3: Start the TikTok integration in Kommo

In Kommo:
- open `Settings`
- open `Integrations`
- open `TikTok`
- click `Install`

### Step 4: Authorize with TikTok

In Kommo:
- click `Continue with TikTok`

In the TikTok authorization flow:
- log in with the TikTok Business Account
- grant Kommo access to the account

After approval:
- the TikTok account should return to Kommo as connected

### Step 5: Confirm the TikTok integration is active

In Kommo:
- verify that the TikTok integration appears connected
- verify that the correct TikTok account is attached

Expected result:
- Kommo can now create leads from TikTok interactions and receive supported TikTok conversations

### Step 6: Test inbound and outbound messaging

From a separate TikTok account:
- send a direct message to the business TikTok account
- confirm the message appears in Kommo
- reply from Kommo
- confirm the reply appears in TikTok

Also test:
- a comment on a TikTok post, if ATP plans to use comment-based workflows

### Step 7: Decide the staff operating rule

Recommended operating rule:
- staff should reply from Kommo instead of from the TikTok app when the conversation needs to stay fully tracked in CRM

This keeps:
- the lead timeline cleaner
- the messaging history centralized
- automation behavior more predictable

## Post-Connection Features To Configure

After the connection is active, Kommo supports several TikTok-specific features that should be considered during setup.

### Step 8: Configure the Welcome Message

Kommo's TikTok integration supports a TikTok-reviewed welcome message.

Purpose:
- it greets new users automatically
- it helps accept the conversation flow without manual staff action
- it allows users to send more than the default initial message limit described by Kommo

In Kommo:
- open the TikTok integration widget
- find the `Welcome message` section
- click `Manage`
- enable the welcome message
- write the message
- submit it for TikTok review

Important current limits:
- keep the message comfortably below the stated maximum length
- approval is required before it becomes active

### Step 9: Configure Suggested Questions

Kommo also supports TikTok suggested questions.

Purpose:
- present common starter questions to new leads
- let users tap a question and receive an immediate prepared answer

In Kommo:
- open the TikTok integration widget
- find `Suggested questions`
- click `Manage`
- enable the feature
- add the questions and answers
- submit them for TikTok review

Operational note:
- these are meant for users who have not already had a conversation with the business

### Step 10: Configure Chat Prompts

Kommo supports TikTok chat prompts.

Purpose:
- show quick action buttons above the TikTok message box
- send a predefined message to the business when the user taps the prompt

In Kommo:
- open the TikTok integration widget
- find `Chat prompts`
- click `Manage`
- enable the feature
- add prompt items
- submit each item for TikTok review

Current practical limits:
- prompt text is short
- approval is required
- edited prompts must be reviewed again before going live

## Supported Interaction Types

Kommo's current TikTok integration supports workflows such as:
- inbound direct messages
- outbound replies to supported direct messages
- quote replies for supported messages
- replying to comments
- reacting to comments
- seeing previews of posts referenced in supported interactions

It also supports lead creation and automation use cases such as:
- creating new leads from TikTok interactions
- using Salesbot with TikTok-originated leads
- using broadcasts with TikTok leads

## Messaging Rules To Keep In Mind

Kommo's current TikTok guide notes the following messaging rules:
- you can send up to 10 messages within 48 hours after receiving a message
- after that 48-hour period, you must wait for the user to reply again before sending more messages

This means ATP should treat TikTok like a constrained conversation window, not an unlimited outbound messaging channel.

## Content Support Limits

Kommo currently notes support for:
- text
- images
- plain-text links
- TikTok post shares

Kommo also notes current non-support or restrictions for:
- videos in regular messaging
- buttons in regular messaging
- quote replies containing media
- reactions visibility for comments and DMs

## Special TikTok Restrictions

Keep these platform behaviors in mind:
- you cannot message a private TikTok account first if they do not follow you
- you can still answer if that account messages you first

This matters for ATP expectations around proactive outreach.

## Common Failure Cases

### TikTok authorization succeeds but no messages appear in Kommo

Likely causes:
- direct-message privacy settings were not enabled correctly
- the wrong TikTok account was authorized

Action:
- check the TikTok direct-message request settings again
- confirm the exact TikTok Business Account connected in Kommo

### TikTok account cannot be authorized

Likely causes:
- the account is not a Business Account
- the account was created in an unsupported region for this integration

Action:
- confirm the account type in TikTok
- confirm that the business account falls within Kommo's supported signup regions

### Outbound replies stop working after some back-and-forth

Likely cause:
- TikTok's reply window or message-count restriction has been reached

Action:
- check whether 48 hours have passed since the last inbound message
- check whether the 10-message limit within the active window has already been used
- wait for the user to reply again if the window has closed

### Welcome message, suggested questions, or chat prompts do not appear

Likely causes:
- the feature has not yet been approved by TikTok
- the submitted text was rejected
- the feature is enabled in Kommo but still in review

Action:
- check the status in the TikTok integration widget
- edit the content to comply with TikTok policies
- resubmit for review

### Wrong TikTok account is connected

Likely cause:
- the wrong business account was selected during authorization

Action:
- disconnect the TikTok integration
- reconnect using the correct TikTok Business Account

## Explicit Non-Goals

This document does not cover:
- TikTok Ads Manager integration
- TikTok Instant Forms
- TikTok Instant Messaging ads setup
- TikTok content strategy
- advanced Salesbot design

## Recommended Operational Checklist

Use this order during the real setup session:

1. Confirm the TikTok account should be used for business communication.
2. Confirm it is switched to a Business Account.
3. Confirm it was created in a Kommo-supported region.
4. Enable direct-message requests for the required audience groups in TikTok.
5. Open `Settings > Integrations > TikTok` in Kommo.
6. Click `Install`.
7. Click `Continue with TikTok`.
8. Log in and grant TikTok access to Kommo.
9. Return to Kommo and confirm the integration is active.
10. Test inbound and outbound direct messages.
11. If needed, test comment-based workflows.
12. Configure the welcome message.
13. Configure suggested questions.
14. Configure chat prompts.
15. Instruct staff to reply from Kommo for tracked conversations.

## References

- [Kommo: Connect TikTok to Kommo](https://www.kommo.com/support/messenger-apps/tiktok/)
- [Kommo: TikTok integration overview](https://www.kommo.com/integrations/tiktok/)
- [TikTok: Account types on TikTok](https://support.tiktok.com/en/using-tiktok/growing-your-audience/switching-to-a-creator-or-business-account)
- [TikTok: Manage direct messages](https://support.tiktok.com/en/account-and-privacy/account-privacy-settings/direct-message)
