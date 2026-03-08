# Booking Client Assignment In `booking.html`

The booking detail page keeps the `change` button next to the current client and uses the submitted booking form data to decide how client assignment works.

## Shared rules

- The panel starts with `Information in booking form: ...` built from the submitted name, email, and phone number.
- Similar customers are sorted by similarity before display.
- Phone number and email matches have higher weight than name similarity.

## Case 1: `number_of_travelers` is missing or `1`

- If at least one similar customer exists, show a dropdown with first option `Similar Customer`.
- Keep the `Select` button disabled until a customer is chosen.
- When an existing customer is assigned, update these customer fields from non-empty booking form values:
  - `name`
  - `email`
  - `phone_number`
  - `preferred_language`
  - `preferred_currency`
- Also show `create a new customer for {name}`.
- Pressing that button creates a new customer from the submitted booking form fields and assigns the booking to that customer.

## Case 2: `number_of_travelers` is greater than `1`

- Show a `group name` text field.
- Show the title `Select group contact:`.
- If similar customers exist, show the same similarity-sorted dropdown.
- Keep `Select` disabled until both a similar customer is chosen and `group name` is non-empty.
- Also show `create the group contact for {name}`.
- Keep that create button disabled until `group name` is non-empty and the submitted booking name exists.

When the group contact is selected or created:

1. Create a new customer or update the selected customer from non-empty booking form values.
2. Create a travel group with the entered `group name`.
3. Set the customer id as `group_contact_customer_id`.
4. Copy these booking fields into the travel group:
   - `travel_month`
   - `number_of_travelers`
   - `travel_duration`
   - `budget_lower_USD`
   - `budget_upper_USD`
   - `notes`
5. Assign the booking to the created travel group.
