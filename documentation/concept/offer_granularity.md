# Offer Detail Level

## Goal

Separate:

- internal offer detail level
- customer-visible offer detail level

ATP often needs to calculate with detailed commercial structure while presenting a simpler customer-facing offer.

Examples:

- internal: `component`, visible: `trip`
- internal: `component`, visible: `day`
- internal: `day`, visible: `trip`

This is better than forcing one field to do both jobs.

## Core Recommendation

Use two explicit fields:

- `offer_detail_level_internal`
- `offer_detail_level_visible`

Internal detail level is canonical for calculation.

Visible detail level is canonical for customer rendering.

## Detail Level Order

Use this partial order:

- `component` = most specific
- `day` = medium
- `trip` = least specific

## Validity Rule

Visible detail level may be equal to or less specific than internal detail level.

Visible detail level must never be more specific than internal detail level.

Allowed:

- internal `component` -> visible `component`
- internal `component` -> visible `day`
- internal `component` -> visible `trip`
- internal `day` -> visible `day`
- internal `day` -> visible `trip`
- internal `trip` -> visible `trip`

Not allowed:

- internal `trip` -> visible `day`
- internal `trip` -> visible `component`
- internal `day` -> visible `component`

## Why This Matters

This model preserves:

- internal explainability
- detailed commercial control
- clean customer-facing offers

It avoids a bad tradeoff where ATP must either:

- store only coarse customer-facing pricing and lose detail
- or expose internal line-item structure to the customer

With two fields:

- internal totals remain fully auditable
- visible structures can be derived from the canonical internals
- PDFs and UI stay simple without throwing away pricing detail

## Canonical Model

### Core fields

- `offer_detail_level_internal: "trip" | "day" | "component"`
- `offer_detail_level_visible: "trip" | "day" | "component"`
- `currency`
- `discounts[]`
- `taxes[]`
- `payment_terms`

### Canonical internal pricing blocks

Exactly one internal pricing block is canonical, depending on `offer_detail_level_internal`.

#### Internal trip pricing

- `trip_price_internal`
  - `label`
  - `amount`
  - `notes?`

#### Internal day pricing

- `days_internal[]`
  - `day_number`
  - `label?`
  - `amount`
  - `notes?`

#### Internal component pricing

- `components_internal[]`
  - current offer component model
  - optional day association
  - optional presentation metadata if needed later

### Additional items

Always allowed:

- `additional_items[]`
  - `id`
  - `label`
  - `amount`
  - `quantity`
  - `notes?`
  - `day_number?`
  - `category?`

These are additive commercial lines on top of the main internal structure.

They should always remain customer-visible.

## Visible Pricing Is a Projection

Visible pricing should usually be treated as a projection of the canonical internal structure.

Examples:

- internal `component` + visible `day`
  day totals are derived by grouping components by day
- internal `component` + visible `trip`
  one trip total is derived by summing the main priced components
- internal `day` + visible `trip`
  trip total is derived by summing all day totals

This means `days[]` and `trip_price` should not always be assumed to be canonical stored pricing blocks.

In many cases they are view projections.

## Presentation Metadata

If ATP needs visible-level labels or notes that cannot be derived from the internal structure, keep that separate from canonical pricing math.

Recommended direction:

- canonical internal pricing stays calculation-safe
- visible presentation metadata stays render-oriented

Examples of presentation-only metadata:

- day label overrides for customer PDFs
- visible section notes
- trip-level summary label
- customer-facing grouping headings

These should not replace the internal pricing structure.

## Total Calculation Rules

Totals are always calculated from the internal structure.

Recommended pipeline:

1. calculate internal main subtotal
2. add `additional_items[]`
3. apply discounts
4. apply taxes
5. produce final total

### Main subtotal logic

- if `offer_detail_level_internal = trip`
  - `main_subtotal = trip_price_internal.amount`
- if `offer_detail_level_internal = day`
  - `main_subtotal = sum(days_internal[].amount)`
- if `offer_detail_level_internal = component`
  - `main_subtotal = sum(component totals)`

### Additional items subtotal

- `additional_subtotal = sum(additional_items[].amount * quantity)`

### Final formula

- `pre_discount_total = main_subtotal + additional_subtotal`
- then existing discount and tax logic applies

## Validation Rules

The backend should enforce:

1. exactly one canonical internal pricing block is active
2. `offer_detail_level_visible` is not more specific than `offer_detail_level_internal`
3. visible projections can be derived from the internal structure
4. presentation metadata cannot override calculation totals directly

Recommended helper order:

- `component = 3`
- `day = 2`
- `trip = 1`

Then validate:

- `visible_rank <= internal_rank`

## UI Behavior

### Offer editor

Expose two separate controls:

- internal offer detail level
- customer-visible offer detail level

The UI must make the distinction explicit:

- internal controls determine calculation structure
- visible controls determine customer rendering structure

### Internal editor sections

Show exactly one canonical internal editor based on `offer_detail_level_internal`.

#### Internal `trip`

Visible:

- trip price editor
- additional items
- discounts
- taxes
- payment terms

#### Internal `day`

Visible:

- day pricing editor
- additional items
- discounts
- taxes
- payment terms

#### Internal `component`

Visible:

- component pricing editor
- additional items
- discounts
- taxes
- payment terms

### Visible preview sections

The customer preview and PDF preview should reflect `offer_detail_level_visible`.

Examples:

- visible `trip`
  show one main trip total
- visible `day`
  show one customer-facing line per day
- visible `component`
  show detailed visible components

## PDF Behavior

Customer documents should always render using the visible detail level.

### Visible `trip`

Show:

- one main trip total
- all `additional_items[]` as separate visible lines
- subtotal / discount / tax / total

### Visible `day`

Show:

- one line per visible priced day
- all `additional_items[]` as separate visible lines
- subtotal / discount / tax / total

### Visible `component`

Show:

- detailed customer-visible line items
- all `additional_items[]` as separate visible lines
- subtotal / discount / tax / total

Important rule:

- PDF presentation must not redefine totals
- it only decides how the already-calculated totals are grouped and shown

## Travel Plan Service Linkage

Travel-plan services should no longer assume that customer-visible pricing structure must match internal calculation structure one-to-one.

Recommended service-side linkage fields:

- `offer_link_mode`
  - `none`
  - `component`
  - `day`
  - `trip`
- `linked_offer_component_ids[]`
- `linked_day_number?`

Interpretation:

- `none`
  no direct commercial linkage
- `component`
  covered by internal components
- `day`
  covered by day-level commercial structure
- `trip`
  covered by whole-trip pricing

The default service state remains:

- `No offer component`

This replaces:

- `No financial coverage needed`

That wording is clearer because it describes linkage state, not an abstract accounting rule.

## Invoices

Invoices do not need a separate detail level model.

They should consume:

- final totals
- payment terms
- selected invoice lines if detailed display is required

The key principle is:

- offer detail level affects commercial editing and customer presentation
- it should not distort downstream accounting logic

## Biggest Design Consequence

The biggest shift is this:

- `days[]` and `trip_price` are not always canonical stored pricing blocks
- they may be derived visible projections

That is a good thing.

It means ATP can keep fine internal detail while still showing simpler pricing externally.

## Recommended Next Step Before Implementation

Before coding, define these precisely:

1. exact canonical internal model
2. visible projection rules for each allowed pair
3. validation rule for `visible <= internal`
4. PDF rendering rules for each visible mode
5. service coverage semantics under each internal mode
6. presentation-only metadata needs for day and trip summaries

## Recommendation Summary

Use:

- one offer domain model
- two explicit offer detail level fields
- one canonical internal pricing structure
- one derived or configured visible structure
- one invariant: visible detail level cannot be more specific than internal

This is cleaner than a single detail level field because it preserves:

- pricing control
- internal explainability
- customer simplicity
