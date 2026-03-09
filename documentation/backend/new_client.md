# Booking Client Assignment In `booking.html`

The booking detail page keeps the `change` button next to the current client and uses the submitted booking form data to decide how client assignment works.

## Shared rules
- Similar customers are sorted by similarity before display. The criteria for accepting a similar name is quite strict.
- Phone number and email matches have higher weight than name similarity.



DONE: 
In the model of the tour and the generated code:
- rename destinationCountries to destinations
- rename priceFrom to budget_lower_USD
in the model and code of the booking:
rename travelMonth to web_form_travel_month
rename travel_duration to web_form_ttravel_duration

In the model of the tour and the generated code:
create a model enum for the months (three letter abbreviation)
change seasonality ("Best Nov-Feb") to seasonality_start_month (nov) and seasonality_end_month (feb) using that enum.
update the data in backend/app/data/tours to match this and update the code to match this new variables

With respect to the duration of the tour:
In the model of the tour rename durationDays to travel_duration_days
In the model of the booking add:
travel_start_day
travel_end_day

in the model of the booking 
- add travel_start_day
- add travel_end_day
regenerating the contract so the rename/addition is reflected consistently in generated frontend/backend/iOS code

NOT DONE:

in the model of the booking 
- add web_form_travel_duration_days_min
- add web_form_travel_duration_days_max
regenerating the contract so the rename/addition is reflected consistently in generated frontend/backend/iOS code

web form:
When the user starts filling the form for a tour, preselect the following according to this tour:
travel_month as the first month in tour (seasonality_start_month)
Take the budget_lower_USD from the web form and find the range in BOOKING_BUDGET_OPTIONS that matches this price.
In the web form, then show the travel_month and this price range, converted to the preferred currency



Create a model for ther web form:
destinations (list)
travel_style (list)
travel_month (optional)
number_of_travelers (optional)
preferred_currency
travel_duration_days_min
travel_duration_days_max
name
email
phone_number
budget_lower_USD
budget_upper_USD
preferred_language
notes (optional)
Eiter email or phone_number must be present

## Case 1: `number_of_travelers` is missing or `1`
- The panel starts with `web form: ...` built from the submitted name, email, and phone number.

- If at least one similar customer exists, show a dropdown with first option `Similar Customer`.
- Keep the `Select` button disabled until a customer is chosen.
- When an existing customer is assigned, update these customer fields from non-empty web form values:
  - `name`
  - `email`
  - `phone_number`
  - `preferred_language`
  - `preferred_currency`
- Also show `create a new customer for {name}`.
- Pressing that button creates a new customer from the submitted web form fields and assigns the booking to that customer.

## Case 2: `number_of_travelers` is greater than `1`
- The panel starts with `web form: (X travelers) from xxx` built from the submitted name, email, and phone number.

- Show a `group name` text field, initally empty.

- Show the title `Select group contact:`.

- If a similar customers exist, show a pill with two option in the style of swiftui .pickerstyle .segmented
Option 1: select existing customer as group contact
Option 2: create new group contact

If no similar customers exist, do not show the pill, only implement option 2

If option 1 is selected in the pill:
Show the same similarity-sorted dropdown, but keep `Select` disabled until both a similar customer is chosen and `group name` is non-empty.
When an existing customer is selected: 
Step 1:
Overwrite these values in the existing customer if they did exist in the web form:
name
email
phone_number
preferred_language
preferred_currency
timezone
Step 2:
create a group with the specified group name and the number of travellers and setthe ID of the selected group contact

If option 2 is selected in the pill:
show a button "create group". when pressed:
Step 1:
create a new customer with the values from the web form:
name
email
phone_number
preferred_language
preferred_currency
timezone
Step 2:
create a group with the specified group name and the number of travellers and set the ID of the selected group contact

In both options:
1. Set the customer id as `group_contact_customer_id`.
2. Copy these booking fields into the travel group:
   - `travel_month` (muss sich das booking merken ???!?)
   - `number_of_travelers` (muss sich das booking merken ???!?)
3. Assign the booking to the created travel group.

XXXX sicherstellen, das dies berteits geschen ist!!! :
Copy these booking fields into the booking:
   - `travel_duration`
   - `budget_lower_USD`
   - `budget_upper_USD`
   - `notes`
