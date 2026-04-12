# Offer Granularity

The current offer model supports two internal detail levels:

- `trip`: one internal trip total
- `day`: one internal price row per travel-plan day

Customer-facing pricing can be:

- `trip`
- `day`

Rules:

- The visible detail level may not be finer than the internal detail level.
- Surcharges and discounts stay as separate adjustments in both internal modes.
- Offer payment terms are calculated from the final offer total, independent of the detail level.

Current storage shape:

- `trip_price_internal`
- `days_internal[]`
- `additional_items[]`
- `discounts[]`
- `payment_terms`

The previous component-based offer model is no longer part of the active model or UI. Runtime compatibility shims may still collapse legacy stored data into `trip` or `day`, but new code and new payloads should use only the structures above.
