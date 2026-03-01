# CRM Feature Research Report

Date: 2026-03-01

## 1. Purpose

This report summarizes what modern CRM systems typically offer, based on current vendor feature sets and platform positioning from major CRM vendors. The goal is not to copy one vendor. The goal is to understand the functional building blocks that appear again and again across serious CRM products, and to identify which of those matter for AsiaTravelPlan.

This is practical product research, not a technical architecture spec.

## 2. Executive Summary

A modern CRM is no longer just a contact database.

Serious CRM systems usually combine these capability groups:
- customer and company records
- lead / deal / booking pipeline management
- activity tracking and task management
- communication history across email, phone, chat, and forms
- automation and workflow rules
- sales support features such as forecasting, quoting, routing, and reminders
- customer service features such as ticketing, SLAs, knowledge base, and case handling
- marketing features such as forms, segmentation, campaigns, journeys, and attribution
- reporting, dashboards, and pipeline analytics
- customization, permissions, mobile access, and integrations
- AI assistance for summarization, recommendations, routing, enrichment, and content generation

In other words: CRM systems have converged toward a unified customer operations platform across sales, service, and marketing.

For AsiaTravelPlan, the relevant subset is narrower:
- customer and traveler records
- booking pipeline
- assignment and handoff between staff
- activity timeline
- notes and communication history
- tasks, reminders, and SLA follow-up
- quoting / itinerary / invoice linkage
- reporting on funnel, conversion, response time, and source attribution

## 3. Core CRM Capability Areas

## 3.1 Contact, Company, and Account Management

This is the baseline feature set in every CRM.

Typical capabilities:
- centralized contact records
- company / account records
- deduplication and merge
- enrichment from forms, email sync, or company databases
- timeline of past interactions
- custom fields
- tags, lists, and segmentation

This is the minimum system of record layer. Without this, the rest of the CRM is fragmented.

Typical data in this area:
- name
- company / household / organization
- email
- phone / WhatsApp
- location
- source
- language
- owner / assigned staff
- notes
- relationship history

## 3.2 Pipeline and Opportunity Management

Most CRMs include a structured pipeline. In a classic sales CRM this is leads, deals, and opportunities. In a travel business this maps cleanly to bookings and booking stages.

Typical capabilities:
- configurable pipeline stages
- stage movement rules
- assignment and ownership
- deal / booking value fields
- expected close or travel dates
- stage aging and time-in-stage tracking
- kanban / list / table views
- filters and saved views
- lead scoring or prioritization
- pipeline forecasting

This is one of the most important CRM functions because it turns customer interest into an operational workflow.

## 3.3 Activity Timeline and Task Management

A CRM almost always keeps a chronological activity log. This is essential for collaboration and accountability.

Typical capabilities:
- notes
- emails sent / received
- calls and call outcomes
- meetings
- reminders
- tasks and follow-ups
- system-generated events such as assignment changes or stage changes
- @mentions / internal collaboration notes

Good CRM systems also make activities actionable:
- task queues
- overdue reminders
- due dates and SLAs
- next-step suggestions
- team dashboards for pending work

For AsiaTravelPlan, this is critical. A booking process naturally produces many follow-ups, internal handoffs, and traveler clarifications.

## 3.4 Communication Tracking

Modern CRMs increasingly try to become the customer interaction history layer.

Typical capabilities:
- email integration and logging
- call logging
- telephony integration or click-to-call
- meeting scheduling
- live chat and chatbot transcripts
- form submissions
- inbox / conversation views
- message templates and snippets

The key value is not only sending messages. The key value is preserving a full communication record tied to the customer and the pipeline object.

## 3.5 Workflow Automation

Automation is now a standard CRM expectation, not an advanced add-on.

Typical capabilities:
- trigger-based workflows
- lead / booking routing
- assignment rules
- SLA reminders
- follow-up sequences
- task creation on stage changes
- automatic field updates
- email notifications
- approvals
- cadences / guided process flows

This is usually where CRM systems stop being passive databases and become operational systems.

## 3.6 Reporting and Analytics

CRM systems almost always include some reporting layer.

Typical capabilities:
- dashboards
- stage conversion metrics
- funnel analytics
- source attribution
- activity performance
- response time metrics
- rep / staff performance
- forecast views
- custom reports
- exports to BI tools

The strongest systems combine operational reporting and management reporting:
- daily work views for staff
- weekly/monthly management views for performance and bottlenecks

## 3.7 Permissions, Roles, and Record Visibility

A real CRM has a non-trivial permission model.

Typical capabilities:
- role-based access control
- field-level permissions
- record ownership
- team-based visibility
- approval rights
- audit log
- impersonation or admin support tools

For AsiaTravelPlan, this is directly relevant. Your role model already reflects a common CRM pattern:
- staff only sees assigned bookings
- manager sees and edits all bookings
- accountant has limited write actions
- admin has full access plus tour administration

This is standard CRM territory.

## 3.8 Customization and Data Modeling

Most modern CRM platforms support more than default contact and deal objects.

Typical capabilities:
- custom fields
- custom record types or objects
- multiple pipelines
- tailored layouts
- validation rules
- conditional fields
- workflow-specific forms
- custom search and filters

This matters because real businesses do not fit a generic B2B sales pipeline exactly.

For a travel business, useful custom objects may include:
- booking
- itinerary
- quote
- departure
- supplier
- guide
- payment / invoice
- traveler group

## 3.9 Service / Support Features

Many CRM systems now include customer service workflows, not only sales.

Typical capabilities:
- case / ticket management
- omnichannel inbox
- queues and routing
- SLAs and escalations
- customer portal
- knowledge base
- self-service content
- feedback, NPS, CSAT, surveys

This is important because many vendors now present CRM as a full revenue + service platform.

For AsiaTravelPlan, this is relevant mainly after booking:
- service issues during trip
- post-booking traveler support
- supplier coordination incidents
- post-trip follow-up

## 3.10 Marketing Features

Many CRMs now include marketing execution directly or tightly connected.

Typical capabilities:
- forms and lead capture
- landing pages
- campaign tracking
- segmentation
- email marketing
- customer journeys / nurture flows
- lead scoring
- ads attribution
- website behavior tracking
- campaign analytics

For AsiaTravelPlan, some of this matters and some does not.

Likely relevant:
- source attribution
- lead capture forms
- segmentation by destination, budget, language, travel style
- remarketing / nurture automation

Less urgent for a small team:
- full multichannel marketing automation suite
- large-scale content orchestration

## 3.11 Mobile and Field Access

Modern CRM systems usually support mobile access.

Typical capabilities:
- mobile app for records and tasks
- push notifications
- quick activity logging
- on-the-go search
- mobile dashboards
- offline or poor-network tolerance

This matters for staff who are traveling, in the field, at hotels, with guides, or using phones during support work.

For your app, the current focus is correct:
- bookings first
- role-aware access
- mobile login with Keycloak
- later customer interaction support

## 3.12 Integrations and Ecosystem

Most CRM systems are integration hubs.

Typical integrations:
- email and calendar
- telephony
- website forms
- marketing tools
- ERP/accounting
- payment systems
- support systems
- data warehouse / BI
- internal chat tools
- API and webhooks

CRM systems increasingly win by being the operational center connected to everything else.

For AsiaTravelPlan, the highest-value integrations are probably:
- email
- WhatsApp or messaging proxy workflows
- invoice / accounting flow
- payment status
- itinerary / quote generation
- website form capture
- later maybe supplier / inventory systems

## 3.13 AI Features

AI is now a major CRM feature category.

Typical capabilities:
- contact and account summarization
- email drafting
- call transcription and summarization
- next-best-action suggestions
- lead prioritization
- anomaly detection
- forecasting support
- chatbot / self-service support
- data enrichment and intent signals

This area is expanding rapidly, but most AI CRM value still sits on top of classic CRM foundations:
- clean records
- good timelines
- strong workflow structure
- permission-aware data access

Without those, AI features mostly produce noise.

## 4. Cross-Vendor Feature Pattern

Across Salesforce, HubSpot, Zoho, and Microsoft Dynamics, the same pattern appears:

1. CRM begins with contact and account records.
2. It expands into pipeline and task management.
3. It then adds automation, reporting, and communication logging.
4. Mature suites unify sales, service, and marketing.
5. AI is being added as an accelerator layer on top of unified data.

The differences are mainly in:
- depth of enterprise customization
- breadth of service and marketing tooling
- reporting sophistication
- ecosystem size
- admin complexity
- pricing and implementation effort

## 5. What a CRM Usually Does Not Cover Alone

Even broad CRM suites do not automatically solve everything.

Common gaps:
- deep accounting / general ledger
- deep product inventory or ERP
- specialized operations tooling
- domain-specific planning engines
- rich document production for niche workflows
- supplier contracting systems
- custom booking logic for verticals like travel

So for a travel company, a CRM usually needs domain extensions.

## 6. What This Means for AsiaTravelPlan

AsiaTravelPlan should not try to build a generic full-market CRM. It should build the travel-operations subset that matters.

## 6.1 Must-Have CRM Features for AsiaTravelPlan

These are clearly justified:
- customer records
- booking records
- booking stages
- assignment to staff
- activity timeline
- single editable booking note plus change history events
- reminders / SLA follow-up
- search, filters, and saved operational views
- source attribution
- invoice linkage
- quote / itinerary linkage
- role-based visibility
- mobile booking access

## 6.2 High-Value Next Features

These are strong next candidates:
- task objects instead of only activity entries
- dashboard for overdue bookings and next actions
- customer communication log across email / WhatsApp / phone
- quote object and quote status lifecycle
- booking checklist / readiness workflow
- staff workload and assignment balancing
- post-trip follow-up workflow
- traveler documents / attachments

## 6.3 Likely Later Features

These are useful later, but not first:
- full ticketing / service desk
- knowledge base / customer portal
- full marketing automation journeys
- advanced forecasting
- AI summarization and suggestions
- supplier / guide management as a first-class module

## 7. Recommended Product Framing

The right framing is:
- not a generic CRM
- not just a booking admin page
- but a travel CRM and booking operations system

That means the primary objects should be:
- customer
- booking
- activity
- staff
- tour
- quote
- invoice
- later supplier / guide / departure / traveler group

## 8. Recommended Prioritization

A sensible order is:

### Phase 1: Core operational CRM
- customers
- bookings
- stages
- assignment
- activity timeline
- note editing
- staff permissions
- mobile booking access

### Phase 2: Operational discipline
- tasks
- SLA dashboard
- better reporting
- assignment balancing
- booking conflict handling and concurrency control
- stronger auditability

### Phase 3: Revenue workflow
- quotes
- itinerary approval flow
- invoice/payment linkage
- pipeline conversion reporting

### Phase 4: Service and retention
- support cases
- post-trip issues
- surveys / satisfaction
- repeat booking workflows

## 9. Bottom Line

A modern CRM system typically offers far more than contact storage. It usually combines record management, pipeline management, communications, automation, reporting, service tools, marketing tools, permissions, integrations, mobile access, and increasingly AI.

For AsiaTravelPlan, the correct target is not the entire CRM universe. The correct target is a focused travel CRM built around bookings, customers, assignment, follow-up, communication history, and revenue workflow.

That is large enough to be valuable and small enough to execute.

## 10. Source Notes

The feature patterns above were cross-checked against current official product and feature pages from major CRM vendors on 2026-03-01:
- Salesforce CRM overview: [salesforce.com/crm/cloud-crm](https://www.salesforce.com/crm/cloud-crm/)
- Salesforce Sales Cloud features: [salesforce.com/sales-cloud/features](https://www.salesforce.com/sales-cloud/features/)
- Salesforce Service Cloud guide: [salesforce.com/service/cloud/guide](https://www.salesforce.com/service/cloud/guide/)
- HubSpot CRM overview: [hubspot.com/products/crm](https://www.hubspot.com/products/crm)
- HubSpot contact management: [hubspot.com/products/crm/contact-management](https://www.hubspot.com/products/crm/contact-management)
- HubSpot Service Hub: [hubspot.com/products/service](https://www.hubspot.com/products/service)
- Zoho CRM feature suite: [zoho.com/crm/features.html](https://www.zoho.com/crm/features.html)
- Zoho CX platform features: [zoho.com/crm/cx-platform/features](https://www.zoho.com/crm/cx-platform/features/)
- Zoho Marketing Automation / journeys: [zoho.com/marketingplus/marketing-automation.html](https://www.zoho.com/marketingplus/marketing-automation.html)
- Microsoft Dynamics 365 Customer Insights: [microsoft.com/dynamics-365/products/customer-insights](https://www.microsoft.com/en-us/dynamics-365/products/customer-insights)
- Microsoft Dynamics 365 Contact Center: [microsoft.com/dynamics-365/products/contact-center](https://www.microsoft.com/en-us/dynamics-365/products/contact-center)
- Microsoft Dynamics 365 CRM positioning: [microsoft.com/dynamics-365/solutions/crm/make-the-switch](https://www.microsoft.com/en-us/dynamics-365/solutions/crm/make-the-switch)

Inference note:
- The vendor pages do not use identical category names, but they consistently cluster around the same practical feature groups: records, pipeline, communication, automation, analytics, service, marketing, mobile, integrations, and AI.
