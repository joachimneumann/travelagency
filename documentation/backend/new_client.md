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

in the model of the booking 
- add web_form_travel_duration_days_min
- add web_form_travel_duration_days_max
regenerating the contract so the rename/addition is reflected consistently in generated frontend/backend/iOS code

web form:
When the user starts filling the form for a tour, preselect the following according to this tour:
travel_month as the first month in tour (seasonality_start_month)
Take the budget_lower_USD from the web form and find the range in BOOKING_BUDGET_OPTIONS that matches this price.
In the web form, then show the travel_month and this price range, converted to the preferred currency

Create a model for the web form:
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

generate code for the web form from this model, remove hard-coded code.

NOT DONE:

When assigning a new client or changing the client in booking:

- The panel starts with `web form request: ...` built from the submitted name, email, and phone number.

Case 1: `number_of_travelers` is missing or `1`
In this case, we assign a customer to the booking.

case 1.1: No similar customer exists
    Show `create a new customer for {name}` button. When pressed set these customer fields from the booking web_form_submission data:
    - name
    - email (if available)
    - phone_number (if available)
    - preferred_language

Case 1.2: at least one similar customer exists
    Show a pill with three options in the style of swiftui .pickerstyle .segmented
    Case 1.2.1: new customer
        Show what is described in case 1.1
    Case 1.2.2: similar customer
        Show a dropdown of similar customers with first option `Similar Customer`.
        After selecting an existing customer, show a button "select as client".
        When the button is pressed, the check if these values are identical:
        - name
        - email (if available)
        - phone_number (if available)
        - preferred_language
        If they are not identical show a question for each non-identical value that forces the user to choose between
        a) keep the xxx: xxx in the customer
        b) overwrite xxx with xxx from the web form
    Case 1.2.3: all customers
        Show search field that allows the atp_staff to search for a customer. To the right of this field show a button "search"
        In the paginated search results table, show a button "select" in the first column.
        The other columns are: ID (link to customer), name, email, and phone_number
        When the "select" button is pressed for one of the customers, do the same value check as described in case 1.2.2

Case 2: `number_of_travelers` is greater than `1`
    Show a `group name` text field, initally empty.
    
    Show the title `Select group contact:`
    Use the same UI and logic as Case 1.2 with the three options, 
    but here, it choses the group contact, not the customer.
    
    When the group contact has been created or selected set the customer id as `group_contact_customer_id`.
