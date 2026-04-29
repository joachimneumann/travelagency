# Kommo WhatsApp API Migration

Date: 2026-04-29

## Goal

Move an existing business phone number from the regular WhatsApp iPhone app into the official Meta WhatsApp Business Platform used by Kommo.

This document covers the case where:
- the phone number is currently active in the regular WhatsApp app on one iPhone
- Meta Business is available already
- WhatsApp is not yet set up in Meta
- the target is Kommo's official WhatsApp Business integration, not WhatsApp Lite

## Important Constraint

The number cannot stay active in the regular WhatsApp app if it is being moved to the official Meta WhatsApp API used by Kommo.

For this migration:
- deleting the app is not enough
- the WhatsApp account for that number must be deleted from inside the app first
- important chats should be backed up or exported before the move

## Recommended Path

Start the onboarding inside Kommo, not inside Meta.

Reason:
- Kommo's native integration uses Meta's embedded signup flow
- this is the simplest path for creating or attaching the correct WhatsApp Business Account
- it reduces the risk of creating the wrong Meta-side setup manually

## Preconditions

Before starting, confirm:
- the Meta Business Portfolio is the correct business
- the person doing the setup has admin rights in Meta
- the person doing the setup can log into the relevant Kommo account
- the phone number can receive SMS or voice calls
- the number is not already connected to another WhatsApp API provider
- a paid Kommo account or active trial is available

## Migration Steps

### 1. Confirm the correct Meta Business Portfolio

In Meta:
- open the existing Business Portfolio
- confirm this is the business that should own the WhatsApp Business Account
- use this same business during the Kommo onboarding flow

Do not create a new business unless there is a deliberate reason to separate ownership.

### 2. Prepare the phone number

Confirm that the phone number:
- is the exact number intended for customer communication
- can receive an SMS verification code or phone call
- is not needed for continued use in the regular WhatsApp app after migration

### 3. Back up or export existing WhatsApp chats

On the iPhone:
- back up WhatsApp chats if needed
- export any important customer chats separately if they must be retained outside the app

Assumption:
- old chat history should not be treated as safely recoverable after the number is moved to the API flow

### 4. Delete the current WhatsApp account from the iPhone

On the iPhone:
- open WhatsApp
- go to account settings
- use the in-app `Delete My Account` flow

Important:
- uninstalling the app without deleting the account is not sufficient
- Meta and Kommo may reject the number as still being in use

### 5. Start the setup inside Kommo

In Kommo:
- open `WhatsApp` or `WhatsApp Business`
- click `Connect` or `+Install`
- choose the official WhatsApp Business integration

Do not choose:
- `WhatsApp Lite`

### 6. Begin the Meta embedded signup flow

In Kommo:
- choose `Use another phone number` or `Link WhatsApp number`
- click `Continue with Facebook`

This should open Meta's embedded signup flow.

### 7. Log into Meta with the correct Facebook account

In the Meta popup:
- log in with the personal Facebook account that has access to the correct Business Portfolio

### 8. Select the existing Business Portfolio

In the Meta flow:
- choose the existing Business Portfolio
- do not create a new Business Portfolio unless intentionally required

This determines which business owns the WhatsApp Business Account and phone number.

### 9. Create or attach the WhatsApp Business Account

In the Meta flow:
- allow Meta to create or attach the WhatsApp Business Account for this business
- enter the business profile details Meta requests

Typical details:
- display name
- business category
- business description if requested

### 10. Add and verify the phone number

In the Meta flow:
- enter the phone number that was removed from the iPhone app
- choose verification by `SMS` or `voice call`
- receive the code
- enter the code

If verification fails, stop and confirm the account was fully deleted from the WhatsApp app first.

### 11. Approve Kommo access

In the Meta permissions screen:
- review the access request
- approve the permissions needed for Kommo

### 12. Finish the setup in Kommo

Back in Kommo:
- click `Finish`
- wait for the number status to change to connected

Expected result:
- the WhatsApp number appears as connected in Kommo

## Meta Tasks After Connection

### 13. Open WhatsApp Manager

In Meta Business Suite:
- go to `Accounts`
- open `WhatsApp Accounts`
- select the connected WhatsApp Business Account
- open `WhatsApp Manager`

This is the main Meta-side management area for:
- templates
- quality rating
- phone number status
- business profile
- billing

### 14. Add a payment method

In Meta:
- add a payment method for the WhatsApp Business Account

This is important because:
- business-initiated messaging depends on templates
- paid messaging features can fail without billing configured

### 15. Check business verification status

In Meta:
- review whether the Business Portfolio is verified

Recommended:
- complete business verification for production use

Why:
- template usage and other Meta-reviewed business messaging features work more reliably once the business is properly verified

### 16. Confirm display name and business profile

In Meta:
- confirm the display name is correct
- confirm the business profile details are correct

If Meta places the display name under review:
- wait for approval before treating the setup as fully production-ready

## Kommo Tasks After Connection

### 17. Confirm the channel status

In Kommo:
- verify that the WhatsApp Business channel is marked as connected

### 18. Create at least one WhatsApp template

In Kommo:
- create one or more WhatsApp templates
- submit them for Meta approval

Why:
- free-form replies only work within the customer service window
- outbound business-initiated messages require approved templates

### 19. Run an end-to-end test

Test from a separate personal number:
- send a message to the business WhatsApp number
- confirm the message appears in Kommo
- reply from Kommo
- confirm the reply is received on the personal WhatsApp account

## Messaging Rules To Keep In Mind

- if a customer messages first, a 24-hour customer service window opens
- during that window, free-form replies are allowed
- outside that window, approved templates are required
- outbound campaigns, follow-ups, and reactivation flows should be template-based

## Common Failure Cases

### Number already in use

Likely cause:
- the regular WhatsApp account on the iPhone was not fully deleted

Action:
- confirm the account was deleted inside WhatsApp
- wait briefly
- retry the verification flow

### Verification code not received

Likely causes:
- SMS delivery issue
- number cannot receive voice calls
- wrong number format

Action:
- retry with the alternate verification method
- confirm the number is entered in full international format

### Connection succeeds but sending fails

Likely causes:
- no Meta payment method
- display name still under review
- template not approved yet

Action:
- add billing in Meta
- check display name status
- check template approval status

### Wrong Meta business selected

Likely cause:
- a different Business Portfolio was chosen during embedded signup

Action:
- stop and verify ownership before continuing further
- avoid building production usage on the wrong business account

### WhatsApp Lite chosen by mistake

Problem:
- this is not the official Meta API integration target

Action:
- disconnect it
- restart using Kommo's WhatsApp Business integration

## Explicit Non-Goals

This document does not cover:
- coexistence with the WhatsApp Business app
- WhatsApp Lite setup
- migration from another BSP such as Twilio, 360dialog, or Gupshup
- detailed template design rules
- developer-side direct Cloud API implementation

## Recommended Operational Checklist

Use this order during the real setup session:

1. Confirm Meta Business Portfolio ownership and admin access.
2. Confirm Kommo access.
3. Confirm the phone number can receive SMS or voice calls.
4. Back up or export important chats from the iPhone.
5. Delete the WhatsApp account from the regular WhatsApp app.
6. Start onboarding inside Kommo.
7. Continue with Facebook.
8. Select the correct Meta Business Portfolio.
9. Create or attach the WhatsApp Business Account.
10. Enter and verify the phone number.
11. Approve Kommo access.
12. Finish the setup in Kommo.
13. Open WhatsApp Manager in Meta.
14. Add a payment method.
15. Check verification and display name status.
16. Create templates in Kommo.
17. Run an inbound and outbound test.
