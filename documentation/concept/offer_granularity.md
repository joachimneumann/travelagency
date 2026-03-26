# Offer Granularity

## Goal

Allow ATP staff to choose how an offer is priced:

1. One price for the complete trip
2. One price per day
3. One price per offer component

The third mode is the current implementation.

In the first two modes, ATP staff must also be able to add additional items that are charged on top.

In the travel-plan service UI, the default state should become `No offer component`.
This replaces the current wording `No financial coverage needed`.

## Why this makes sense

These are three real commercial modes:

- `trip`
  ATP sells one total for the whole trip.
- `day`
  ATP sells a daily structure, but not necessarily each internal service separately.
- `component`
  ATP sells line-by-line offer components, with direct linkage to travel-plan services.

Treating these as explicit offer granularities is better than forcing all pricing into the current component-only structure.

## Recommendation

Do not create three unrelated offer models.

Use one offer model with:

- `pricing_granularity`
- one primary pricing section depending on that granularity
- one shared additive section for items charged on top

This keeps:

- totals
- discounts
- taxes
- payment terms
- PDFs
- invoices

on one coherent calculation path.

## Proposed Offer Shape

Use a single `offer` with:

- `pricing_granularity: trip | day | component`

Exactly one main pricing block is active:

- `trip_price`
- `day_prices[]`
- `components[]`

Always allowed:

- `additional_items[]`
- discounts
- taxes
- payment terms

## Proposed Model

This is the proposed logical shape.

It is not yet an implementation commitment, but it is the recommended target.

### Core offer fields

- `pricing_granularity: "trip" | "day" | "component"`
- `currency`
- `discounts[]`
- `taxes[]`
- `payment_terms`

### Main pricing blocks

Exactly one of these is used, depending on `pricing_granularity`.

#### A. Trip pricing

- `trip_price`
  - `label`
  - `amount`
  - `notes?`

Use for one clean total for the main trip.

#### B. Day pricing

- `days[]`
  - `day_number`
  - `label?`
  - `amount`
  - `notes?`

Use when ATP wants one main price per day.

#### C. Component pricing

- `components[]`
  - current offer component model
  - plus optional day association already discussed elsewhere

Use when ATP wants the most detailed commercial structure.

### Additional items

Always allowed:

- `additional_items[]`
  - `id`
  - `label`
  - `amount`
  - `quantity`
  - `notes?`
  - `day_number?: int`
  - `category?: optional`

Purpose:

- extras charged on top of the main granularity
- supported for all three modes
- especially important for `trip` and `day`

### Travel plan service linkage

Travel-plan services should no longer assume that every service needs a direct offer component.

Recommended service-side financial linkage fields:

- `offer_link_mode`
  - `none`
  - `component`
  - `day`
  - `trip`
- `linked_offer_component_ids[]`
- `linked_day_number?`

Interpretation:

- `none`
  service has no direct financial linkage
- `component`
  service is financially represented by one or more offer components
- `day`
  service is covered by the commercial day price
- `trip`
  service is covered only by the whole-trip price

### Default service state

The default service state becomes:

- `No offer component`

This replaces:

- `No financial coverage needed`

That wording is better because it describes actual linkage state.

## Proposed Total Calculation Rules

Recommended total pipeline:

1. calculate main subtotal from exactly one active main pricing block
2. add `additional_items[]`
3. apply discounts
4. apply taxes
5. produce final offer total

This keeps one calculation path even with three pricing granularities.

### Main subtotal logic

- if `pricing_granularity = trip`
  - `main_subtotal = trip_price.amount`
- if `pricing_granularity = day`
  - `main_subtotal = sum(days[].amount)`
- if `pricing_granularity = component`
  - `main_subtotal = sum(component totals)`

### Additional items subtotal

- `additional_subtotal = sum(additional_items[].amount * quantity)`

### Final pricing formula

- `pre_discount_total = main_subtotal + additional_subtotal`
- then existing discount and tax logic applies

## Proposed UI Behavior Spec

### Offer editor: top-level choice

At the top of the offer editor, ATP staff selects:

- `Complete trip`
- `Per day`
- `Per offer component`

This setting controls which main pricing block is visible.

### Offer editor: visible sections by mode

#### Mode 1: Complete trip

Visible:

- trip price editor
- additional items
- discounts
- taxes
- payment terms

Hidden:

- day pricing table
- offer component pricing table

#### Mode 2: Per day

Visible:

- day pricing table
- additional items
- discounts
- taxes
- payment terms

Hidden:

- trip price editor
- offer component pricing table

#### Mode 3: Per offer component

Visible:

- offer components table
- additional items
- discounts
- taxes
- payment terms

Hidden:

- trip price editor
- day pricing table

### Offer editor: mode switching behavior

Recommended behavior:

- ATP staff can switch granularity explicitly
- when switching, the previous main pricing block should not be silently merged into the new one
- the UI should either:
  - reset the now-inactive block
  - or keep it as draft-only hidden state until save/discard

Recommended first implementation:

- keep inactive blocks in local draft only
- on save, persist only the active block

This is the safest and clearest rule.

### Service UI behavior

#### Default state

Each service starts with:

- `No offer component`

#### In component mode

Service can link to one or more offer components.

Header status options:

- `No offer component`
- `Covered`
- `Partially covered`

#### In day mode

Service can either:

- stay unlinked
- or be marked as covered by its day

Header status options:

- `No offer component`
- `Covered by day`

#### In trip mode

Service can either:

- stay unlinked
- or be marked as covered by trip total

Header status options:

- `No offer component`
- `Covered by trip`

### Additional items UI behavior

Additional items should be a separate section from the main pricing block.

Recommended UI:

- table or list below the main pricing area
- each row includes:
  - label
  - amount
  - quantity
  - optional day
  - optional note

This keeps extras visible without confusing them with the main pricing granularity.

### PDF behavior by mode

#### Trip mode PDF

Show:

- one main trip price line
- separate additional items lines
- subtotal / discount / tax / total

#### Day mode PDF

Show:

- one row per priced day
- separate additional items lines
- subtotal / discount / tax / total

#### Component mode PDF

Show:

- current detailed component structure
- additional items lines
- subtotal / discount / tax / total

### Invoice behavior

Invoices should not need a separate granularity model.

They should consume:

- final totals
- payment terms
- selected commercial lines if line-item display is needed

The key principle is:

- offer granularity changes presentation and main-price structure
- not the downstream accounting logic

## Meaning of Each Granularity

### 1. Trip price

One main price for the complete trip.

Use this when ATP wants to quote one clean total without exposing internal structure.

Additional items may still be added on top, for example:

- airport pickup
- premium room upgrade
- visa support
- optional activity
- surcharge

### 2. Day price

One main price per day.

Use this when ATP wants to present a more structured offer, but not at the level of each service.

Additional items may still be added on top.

### 3. Offer component price

One price per offer component.

This is the current model.

In this mode, service-to-offer linkage remains directly relevant.

## Additional Items

For `trip` and `day`, additional items should be modeled separately from the main pricing block.

Reason:

- they are optional or additive
- they should not distort the main granularity structure
- they still need to appear in totals and PDFs

Examples:

- extra transfer
- extra night
- special meal plan
- room upgrade
- add-on activity

## Travel Plan Service Implications

The current service coverage logic is tightly coupled to offer components.

That must change.

Recommended service states:

- `No offer component`
- `Covered by day`
- `Covered`
- `Partially covered`

Interpretation:

- in `component` mode:
  service coverage is based on linked offer components
- in `day` mode:
  a service can be considered covered by its day even if it has no direct offer component
- in `trip` mode:
  service-level coverage is mostly informational, not financial

## UI Recommendation

At the top of the offer editor, ATP staff chooses:

- `Complete trip`
- `Per day`
- `Per offer component`

Then the editor shows only the relevant main pricing section.

Shared sections remain visible:

- discounts
- taxes
- payment terms
- additional items

## Rename in Services

In travel-plan services:

- replace `No financial coverage needed`
- with `No offer component`

This is clearer because it describes linkage state, not an abstract financial rule.

## Biggest Risk

The biggest complexity is not the backend math.

The biggest complexity is:

- editor clarity
- PDF clarity
- understandable service coverage semantics across all three modes

## Recommended Next Step Before Implementation

Before coding, define these precisely:

1. exact model structure
2. total calculation rules
3. PDF rendering for each granularity
4. service coverage behavior for each granularity
5. invoice implications

## Current Recommendation Summary

Use:

- one offer model
- one explicit granularity field
- one main pricing block depending on granularity
- one shared additive block for additional items

This is the cleanest path forward.
