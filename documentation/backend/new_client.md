# Booking Client Assignment in `booking.html`

The panel starts with `web form request: ...` built from the submitted `name`, `email`, and `phone_number` from `booking.web_form_submission`.

`booking.web_form_submission` is immutable and is only used as the reference snapshot for client assignment and merge decisions.

## Case 1: `number_of_travelers` is missing, `0`, or `1`

In this case, the booking is assigned to a customer.

### Case 1.1: No similar customer exists

- Show a pill with two options in the style of swiftui `.pickerstyle(.segmented)`:
  - `new customer`
  - `search customer`

#### Case 1.1.1: `new customer`

- Show a button `create a new customer for {booking.web_form_submission.name}`.
- When pressed, create a new customer and set these customer fields from `booking.web_form_submission`:
  - `name`
  - `email` (if available)
  - `phone_number` (if available)
  - `preferred_language`
- Then assign this customer to the booking.

#### Case 1.1.2: `search customer`

- Show a search field and to the right a button `search`.
- With empty search term, show the normal paginated customer list.
- In the paginated search results table, show:
  - first column: button `select`
  - other columns:
    - `ID` (link to customer)
    - `name`
    - `email`
    - `phone_number`

##### Case 1.1.2.a: Selected customer data is identical

- Compare these fields:
  - `name`
  - `email` (if present in web form)
  - `phone_number` (if present in web form)
  - `preferred_language` (if present in web form)
- If all relevant values are identical, assign the selected customer directly to the booking.

##### Case 1.1.2.b: Selected customer data is not identical

- Before showing merge actions, show a warning if the selected customer:
  - is group contact of one or more travel groups
  - is assigned as client to one or more bookings
- Show a structured merge table for each differing field.
- Columns:
  - `field`
  - `existing customer value`
  - `web form value`
- Action: For each differing field, force the user to choose one of:
  - `keep existing`
  - `overwrite with web form`
- Missing values in the web form do not count as conflicts and do not trigger a choice.
- After all choices are made, show a button `select customer`.
- When pressed:
  - update the customer according to the chosen merge actions
  - assign the customer to the booking

### Case 1.2: At least one similar customer exists

- Show a pill with three options in the style of swiftui `.pickerstyle(.segmented)`:
  - `new customer`
  - `similar customer`
  - `search customer`

#### Case 1.2.1: `new customer`

- Show the same UI and behavior as in Case 1.1.1.

#### Case 1.2.2: `similar customer`

- Show a dropdown of similar customers with a first option `Similar Customer`.
- After selecting an existing customer, show a button `select as client`, enabled only after selecting a customer.

##### Case 1.2.2.a: Selected customer data is identical

- Compare these fields:
  - `name`
  - `email` (if present in web form)
  - `phone_number` (if present in web form)
  - `preferred_language` (if present in web form)
- If all relevant values are identical, assign the selected customer directly to the booking.
- No merge UI is shown.

##### Case 1.2.2.b: Selected customer data is not identical

- Before showing merge actions, show a warning if the selected customer:
  - is group contact of one or more travel groups
  - is assigned as client to one or more bookings
- Show a structured merge table for each differing field.
- Columns:
  - `field`
  - `existing customer value`
  - `web form value`
- Action: For each differing field, force the user to choose one of:
  - `keep existing`
  - `overwrite with web form`
- Missing values in the web form do not count as conflicts and do not trigger a choice.
- After all choices are made, show a button `select customer`.
- When pressed:
  - update the customer according to the chosen merge actions
  - assign the customer to the booking

#### Case 1.2.3: `search customer`

- Show the same UI and behavior as in Case 1.1.2.

##### Case 1.2.3.a: Selected customer data is identical

- If the selected customer matches the web form data as described in Case 1.1.2.a, assign directly.

##### Case 1.2.3.b: Selected customer data is not identical

- Show the same warning, merge table, and confirmation logic as in Case 1.1.2.b.

- Assign the customer ID as booking client.

## Case 2: `number_of_travelers` is greater than `1`

- Show a segmented control in the style of swiftui `.pickerstyle(.segmented)` with:
  - `use existing group`
  - `new group (recommended)`

### Case 2.1: `use existing group`

- Show a search field and a button `search`.
- With empty search term, show the normal paginated travel group list.
- Search can match either of:
  - `group_name`
  - `group_contact_customer_id`
  - group contact name
  - group contact email
  - group contact phone_number
- In the paginated results table, show:
  - first column: button `select`
  - other columns:
    - `ID` (link to group)
    - `group_name`
    - `group contact`
    - `group contact email`
    - `group contact phone_number`
- When the button `select` is pressed for an existing group, assign this group as booking client.

### Case 2.2: `new group (recommended)`

- Show a `group name (required)` text field, initially empty.
- This field is visible only while the option `new group (recommended)` is active.
- Its value persists when the user switches between `use existing group` and `new group (recommended)`.
- Show the title `Select group contact`.
- Show a second pill with three options in the style of swiftui `.pickerstyle(.segmented)`:
  - `new group contact`
  - `find similar group contact`
  - `search customers`
- These options choose the `group_contact_customer_id` for the new group.

#### Case 2.2.1: `new group contact`

- Show a button `create new customer and group` (disabled if group name is empty).
- When pressed:
  - create a new customer from `booking.web_form_submission` using:
    - `name`
    - `email` (if available)
    - `phone_number` (if available)
    - `preferred_language`
  - create a new travel group and set:
    - `group_contact_customer_id` to the new customer
    - `group_name` to the entered group name
  - assign the new group's client ID as booking client

#### Case 2.2.2: `find similar group contact`

- Show a dropdown of similar customers with first option `Similar Customer` and an initially disabled button `select as group contact`.
- After selecting a customer, enable the button.

##### Case 2.2.2.a: Selected customer data is identical

- If relevant fields are identical as described in Case 1.2.2.a:
  - use the selected customer as `group_contact_customer_id`
  - create a new group
  - set `group_name`
  - assign the new group's client ID as booking client

##### Case 2.2.2.b: Selected customer data is not identical

- Before showing merge actions, show a warning if the selected customer:
  - is group contact of one or more travel groups
  - is assigned as client to one or more bookings
- Show the same structured merge table as in Case 1.2.2.b.
- After all merge choices are made and confirmed:
  - update the selected customer according to the chosen merge actions
  - use that customer as `group_contact_customer_id`
  - create a new group
  - set `group_name`
  - assign the new group's client ID as booking client

#### Case 2.2.3: `search customers`

- Show a search field and a button `search`.
- With empty search term, show the normal paginated customer list.
- In the paginated search results table, show:
  - first column: button `select`
  - other columns:
    - `ID` (link to customer)
    - `name`
    - `email`
    - `phone_number`

##### Case 2.2.3.a: Selected customer data is identical

- Use the selected customer as `group_contact_customer_id`, create the group, and assign the new group's client ID as booking client.

##### Case 2.2.3.b: Selected customer data is not identical

- Before showing merge actions, show a warning if the selected customer:
  - is group contact of one or more travel groups
  - is assigned as client to one or more bookings
- Show the same structured merge table and logic as in Case 2.2.2.b.

## General merge rules

- Phone number and email are stronger identity signals than name.
- Exact phone/email matches should be ranked above name-only matches.
- Name-only matches should be treated as weak matches.
- Default merge action should always be `keep existing`.
- The user must explicitly opt in to overwrite existing customer data.

## Similarity threshold

- A strong match is:
  - exact normalized `phone_number` match
  - or exact normalized `email` match
- A medium match is:
  - exact normalized name match together with any contact overlap
  - or a likely phone match after phone normalization
- A weak match is:
  - similar name only, without `phone_number` or `email` support
- Only strong and medium matches are shown in the default similar customer dropdown.
- Weak name-only matches do not count as similar customer candidates by default, but they may still appear in `search customer` results.
