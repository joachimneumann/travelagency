# Kommo Facebook Messenger Integration

Date: 2026-04-29

## Goal

Connect a Facebook business Page to Kommo so ATP staff can manage Facebook Messenger conversations inside Kommo, automatically create leads from Messenger activity, and use Kommo automation on Messenger-originated leads.

This document covers the current Kommo setup flow for Facebook Messenger and the operational limits that matter after the connection is live.

## Recommended Path

Facebook Messenger in Kommo is connected at the business Page level.

Important platform rule:
- only Facebook business Pages can be connected
- personal Facebook profiles cannot be used as the Messenger source in Kommo

Operational recommendation:
- connect the business Page to the intended Kommo pipeline
- use Kommo as the main reply surface for tracked customer conversations

## Preconditions

Before starting, confirm:
- the Facebook asset is a business Page, not a personal profile
- the person doing the setup has admin-level or equivalent Page access needed to connect the Page
- the Facebook account used for authorization has a primary email address set and verified
- messaging is enabled on the Facebook Page
- the Kommo account is available and the user can access the relevant pipeline and automation settings
- the target Page is not already assigned to a different pipeline in the same Kommo account

## Important Constraints

Kommo's current Facebook Messenger integration has several practical limits:
- only business Pages can be connected
- the same Page cannot be used on multiple pipelines
- one Facebook account and its associated Pages can be connected to one Kommo account at a time
- if ATP staff reply directly in Facebook Messenger instead of Kommo, those outgoing replies may not be reflected correctly in Kommo
- Messenger conversations are subject to Meta's 24-hour messaging window rules

Operational rule:
- if the business wants a complete CRM conversation history, ATP staff should reply from Kommo instead of directly in Facebook Messenger

## Page Access Requirement

Before connecting the Page:
- confirm the setup user can manage the Page
- confirm they can access Page settings and messages

Meta's current Page access model allows different levels of access. In practice, the setup user should have enough Page permissions to:
- manage the Page
- authorize connected tools
- access the Page's messaging features

If access is uncertain:
- verify Page access in Facebook first

## Messaging Requirement

Before connecting Messenger to Kommo:
- confirm the Page can receive messages

In Facebook:
- switch into the Page
- open `Settings`
- open the section that controls how people contact the Page
- verify that messaging is turned on

If messaging is disabled:
- people may not be able to message the Page
- the Kommo integration may connect but not behave as expected

## Setup Steps

### Step 1: Confirm the Facebook account is suitable for authorization

The Facebook account used to connect the Page should:
- be the correct business identity
- have the required Page access
- have a verified email address
- have that email set as the primary contact email

Kommo's current support documentation explicitly calls out the primary verified email requirement.

### Step 2: Confirm the target pipeline in Kommo

Messenger sources in Kommo are pipeline-specific.

Before starting the connection:
- decide which pipeline should own the Facebook Messenger source

Important:
- the same Facebook business Page cannot be connected to multiple pipelines in the same Kommo account
- if multiple Pages are used, different Pages can be connected to different pipelines

### Step 3: Start the Facebook Messenger source in Kommo

Kommo's current support guide describes the setup from the pipeline automation area.

In Kommo:
- open the relevant pipeline
- go to `Leads`
- open `Automate`
- under lead sources, click `+ Add source`
- choose `Facebook Messenger`
- click `Add source`

Depending on Kommo UI changes, the exact button labels may differ slightly, but the setup remains pipeline-based.

### Step 4: Connect the Facebook account

In Kommo:
- click the Facebook login icon or the equivalent connect button

In Facebook:
- log in with the Facebook account that has access to the correct business Page
- authorize Kommo

Use the same Facebook account consistently if ATP already uses other Meta-related Kommo integrations.

### Step 5: Select the business Page

After the Facebook account is connected:
- select the business Page that should be connected to this pipeline

Expected result:
- Messenger messages for that Page can now create leads and conversations in the chosen Kommo pipeline

### Step 6: Confirm the integration is active

In Kommo:
- confirm the selected Page is shown as connected
- confirm the Page is attached to the intended pipeline

### Step 7: Test inbound and outbound messaging

From a separate Facebook account:
- send a message to the business Page
- confirm the message appears in Kommo
- reply from Kommo
- confirm the reply is received in Messenger

If ATP uses post engagement workflows, also test:
- a comment on a Page post
- a Story reaction if relevant to the Page setup

## How Conversations Behave In Kommo

When someone interacts with the connected Page:
- a new chat can appear in Kommo
- a new incoming lead can appear in the pipeline

ATP can then:
- accept the lead
- delete it if it is spam
- link it to an existing contact if the person is already known

Important behavior:
- if the same person writes to different connected Facebook Pages, Kommo can create separate incoming leads

## Staff Operating Rule

Recommended operating rule:
- reply from Kommo whenever the conversation should stay fully tracked in CRM

Why:
- outgoing messages sent directly via Facebook Messenger may not be written back into the Kommo conversation history
- inbound messages still sync, but the full conversation timeline becomes incomplete

## Post-Connection Features To Configure

After the Page is connected, Kommo can be used for:
- direct Messenger replies
- saved replies or templates
- Salesbot automations
- broadcasts within Meta policy limits
- linking incoming chats to existing contacts

### Step 8: Configure Salesbot if ATP wants automated Messenger handling

Kommo supports Salesbot with Facebook Messenger.

Typical uses:
- welcome messages
- lead qualification
- routing based on message content
- follow-up steps inside the pipeline

In Kommo:
- open the relevant Messenger conversation and run a bot manually if needed
- or open `Leads > Automate` and add a Salesbot trigger on the chosen stage

### Step 9: Decide whether Meta opt-in messaging is needed

Standard Messenger replies are restricted by Meta's 24-hour messaging window.

If ATP wants to continue messaging leads outside the normal 24-hour window for approved marketing or subscription topics:
- evaluate Meta opt-in messaging inside Kommo

Kommo currently supports Meta opt-in messaging for Facebook integrations.

This is not required for the initial Messenger connection, but it is relevant for longer follow-up workflows.

## Messaging Rules To Keep In Mind

Kommo's current Messenger guidance and related Meta opt-in documentation indicate:
- standard free-form messaging is constrained by Meta's 24-hour window
- if the customer has not messaged recently, reply options become restricted
- Kommo documents a `human_agent` style extended handling window for certain cases up to 7 days
- after that extended period, normal replies are no longer available without a qualifying Meta-supported mechanism

Operational takeaway:
- ATP should treat Facebook Messenger as a window-based support and sales channel, not as an unlimited outbound channel

## Content And Sending Limits

Kommo's current Facebook Messenger support notes at least one practical sending constraint:
- you cannot send more than one file in a single chat message

Also keep in mind:
- if ATP uses third-party chatbot tools such as ManyChat or Chatfuel, Kommo notes that only incoming messages may synchronize reliably
- outgoing chatbot messages from those external tools may not be reflected correctly in Kommo

## Multi-Page And Multi-Pipeline Behavior

Kommo's current Facebook Messenger support indicates:
- each messenger connection is unique per pipeline
- different business Pages can be connected to different pipelines
- the same business Page cannot be reused across multiple pipelines

This should be planned intentionally before installation if ATP uses multiple Page brands or market-specific funnels.

## Common Failure Cases

### Facebook account connects but the Page cannot be selected

Likely causes:
- the setup user is not the admin or does not have enough Page access
- the wrong Facebook account was used

Action:
- confirm Page access in Facebook
- reconnect using the correct Facebook account

### Facebook authorization fails in Kommo

Likely causes:
- the Facebook account does not have a primary verified email
- the Facebook account is missing the required business identity or permissions

Action:
- add an email to the Facebook account if needed
- make it the primary contact email
- verify the email
- repeat the connection flow

### Messenger is connected but no conversations arrive

Likely causes:
- messaging is disabled on the Page
- the wrong Page was connected

Action:
- turn Page messaging on
- verify the selected Page in Kommo
- run a fresh test message from a separate account

### Outgoing messages are missing from the Kommo conversation history

Likely cause:
- staff replied directly in Facebook Messenger instead of Kommo

Action:
- move the operational reply flow into Kommo
- use the Messenger app only as an exception, not the standard workflow

### The same Page needs to be used in two pipelines

Problem:
- Kommo's current setup does not allow the same business Page to be connected to multiple pipelines

Action:
- choose one pipeline as the Page owner
- or use different Pages for different pipelines

### Facebook account disconnects after being connected elsewhere

Likely cause:
- Kommo notes that one Facebook account and its Pages can only stay connected to one Kommo account at a time

Action:
- verify whether the same Facebook account was connected to a different Kommo account
- reconnect intentionally in the correct account

### Stripe payment links fail in Messenger

Likely cause:
- the payment link domain is not whitelisted in the Page's Messenger platform settings

Action:
- add the link domain to the Facebook Page's whitelisted domains for Messenger

## Explicit Non-Goals

This document does not cover:
- Facebook Lead Ads integration
- Meta Conversions API setup
- Instagram integration
- WhatsApp integration
- advanced ManyChat or Chatfuel architecture

## Recommended Operational Checklist

Use this order during the real setup session:

1. Confirm the source is a Facebook business Page, not a personal profile.
2. Confirm the setup user has sufficient Page access.
3. Confirm the Facebook account has a primary verified email.
4. Confirm Page messaging is turned on.
5. Decide which Kommo pipeline should own the Page.
6. Open `Leads > Automate` in that pipeline.
7. Add `Facebook Messenger` as a lead source.
8. Log into Facebook and authorize Kommo.
9. Select the correct business Page.
10. Confirm the Page is connected in Kommo.
11. Send a test message from a separate Facebook account.
12. Reply from Kommo and confirm delivery.
13. Configure Salesbot if automated Messenger handling is needed.
14. Decide whether Meta opt-in messaging is needed for communication outside the normal 24-hour window.
15. Instruct staff to reply from Kommo for tracked conversations.

## References

- [Kommo: Connect Facebook Messenger to Kommo](https://www.kommo.com/support/messenger-apps/facebook-messenger-integration/)
- [Kommo: Facebook Messenger integration overview](https://www.kommo.com/extensions/messenger)
- [Kommo: Messenger-based sales FAQs](https://www.kommo.com/support/getting-started/messenger-faqs/)
- [Kommo: Use Meta’s opt-in feature for messaging](https://www.kommo.com/support/messenger-apps/meta-opt-in/)
- [Meta: About Facebook Page access](https://www.facebook.com/help/289207354498410/)
- [Meta: Turn messaging on or off for your Facebook Page](https://www.facebook.com/help/307375982614147)
- [Meta: Give, edit or remove Facebook Page access](https://www.facebook.com/help/187316341316631)
