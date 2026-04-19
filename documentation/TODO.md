# in progress

Remove stage as a drop down from booking.html. Instead add buttons such as travel plan sent to customer, offer sent to customer, deposit received, etc. 
Then Automatically derive the stage and write a description of the stage and last action at the top of the booking.html page. for example: "Offer sent to customer. Waiting for deposit"

# TODO

staging: git write persmissions

# tour guide / ATP staff

Booking stage
=============
change and save results in: 

[booking-dirty] Section dirty state changed. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', section: 'core', dirty: true, diagnostic: {…}, dirty_sections: Array(1)}
booking.js:480 [booking-dirty] Section dirty state changed. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', section: 'pricing', dirty: true, diagnostic: null, dirty_sections: Array(2)}
booking.js:149 [booking-save] Save button clicked. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', dirty: {…}, has_unsaved_changes: true, page_save_in_flight: false, page_discard_in_flight: false}
booking.js:149 [booking-save] Save flow started. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', dirty: {…}, page_dirty_bar_status: 'saving'}
booking.js:149 [booking-save] Running save task. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', task: 'Booking details'}
booking_page_data.js:103  POST http://localhost:8080/api/v1/bookings/booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b/milestone-actions?content_lang=en&source_lang=en 409 (Conflict)
fetchBookingMutation @ booking_page_data.js:103
fetchBookingMutation @ booking.js:1708
saveCoreEdits @ core.js:1060
saveCoreEdits @ booking.js:1160
run @ booking.js:1371
savePageEdits @ booking.js:1419
(anonymous) @ booking.js:728Understand this error
api.js:39 [booking] Backend rejected a booking mutation request. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', method: 'POST', url: 'http://localhost:8080/api/v1/bookings/booking_dec5…/milestone-actions?content_lang=en&source_lang=en', status: 409, status_text: 'Conflict', …}
logBrowserConsoleError @ api.js:39
fetchBookingMutation @ booking_page_data.js:125
await in fetchBookingMutation
fetchBookingMutation @ booking.js:1708
saveCoreEdits @ core.js:1060
saveCoreEdits @ booking.js:1160
run @ booking.js:1371
savePageEdits @ booking.js:1419
(anonymous) @ booking.js:728Understand this error
booking.js:149 [booking-save] Save task finished. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', task: 'Booking details', duration_ms: 11, result: 'blocked_or_failed'}
booking.js:149 [booking-save] Save flow stopped because a task returned false. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', task: 'Booking details', dirty: {…}}
booking.js:149 [booking-save] Save flow finalized. {booking_id: 'booking_dec5e3e2-bef7-44f2-8dc9-22b0ad162e3b', save_completed: false, duration_ms: 12, page_dirty_bar_status: '', dirty: {…}}

Can you add a feature to the booking.html page, in the danger zone at the bottom:
Clone Booking with a "new title" textfield.
When pressed, the booking should be cloned following the rules set in the cloning script (new IDs)

Database structure around travelplan, inclusing destinations and style
What is copied when a travel plan is copied?
What is copied when a booking is copied?
Datenstructue (cue)
service
day can have 0+ services
before tour
after tour day
Travel plan has days and destinations
Core Booking
Core Booking with traveler
Booking
booking has rumpf booking and more

I want to change the Status visibility and payment logic. Update the document payment to reflect this logic. You may completely rewrite the payments.md file.
======
- completely remove the Stage logic (before versus after deposit paid), remove all of these stages:
Before deposit received
New booking
Travel plan sent
Offer sent
Negotiation
Deposit requested
Booking lost
Deposit Received
After deposit received
In progress
Trip completed
Booking lost
- remove all booking milestones / status from the model, code and UI
- remove all buttons
- remove all badge/status, e.g., Awaiting payment

- completely remove the next steps logic (Proposal in progress, Proposal sent, Booking confirmation / Deposit pending, Deposit confirmed, Remaining payments, Fully paid)

Center the logic around the financial flow:
Depost, optional installment payments and final payment

Each stage (deposit, installments payments and final payment according to the payment plan) has:
1. A section for PDF generation to ask for the money (initially collapsed):
1.1: PDF Texts for personalization (initially collapsed)
1.2: PDF Attachments  (initially empty and collapsed)
1.3: Table of generated PDFs
1.4: A button: "new PDF"
2. A Payment received section:
2.2: Amount received
2.3: When received (date)
2.4: Confirmed by (ATP staff drop down)
2.5: Receipt reference (text field)
2.6: Snapshot of the offer (last generated PDF, offer parameters) at the time when the payment has been received
3. A Customer Receipt section (initially collapsed)
3.1: PDF Texts for personalization (initially collapsed)
3.2: PDF Attachments  (initially empty and collapsed)
3.3: Table of generated PDFs
3.4: A button: "new PDF"



Proposal & Payments
===================
remove the Track the current commercial step and the next ATP action.


In the travel plan PDF configuration, add a section "Cancellation policy" with a default value:


In the payments sections, after the deposit has been received and this is confirmed, add a table with Booking confirmations PDFs and a button "create Booking confirmation".

The Booking confirmation PDF shall contain:

- AsiaTravelPlan header
- Title of the booking
- who is traveling
- short table of travel plan (one line per day)
- Your AsiaTravelPlan Contact: name and WhatsApp /Phone
- Total Amount, Deposit Received, Remaining Balance
- and the Deposit Payment Confirmation:
"This document confirms receipt of a deposit payment of XXXX".
					
Thank you for your payment. AsiaTravelPlan looks forward to supporting you throughout your journey.					
					
AsiaTravelPlan				            AsiaTravelPlan	
Director's Signature				Tour Coordinator's Signature	
					

Cancellation policy
===================

For group of 1-10 persons:
If cancellation is made 14 days prior to travel date, 0% of total fee will be charged.
If cancellation is made 7-14 days prior to travel date, 30% of total fee will be charged.
If cancellation is made 0-7 days prior to travel date, 50% of total fee will be charged.

For group of 11-20 persons:
If cancellation is made 21 days prior to travel date, 0% of total fee will be charged.
If cancellation is made 10-21 days prior to travel date, 30% of total fee will be charged.
If cancellation is made 0-10 days prior to travel date, 50% of total fee will be charged.

For group of 21 persons or above:
If cancellation is made 30 days prior to travel date, 0% of total fee will be charged.
If cancellation is made 15-30 days prior to travel date, 30% of total fee will be charged.
If cancellation is made 0-15 days prior to travel date, 50% of total fee will be charged.

Travel plan
===========
* Copy whole travel plan from another booking
** Regenerate all IDs
** set dates blank
* remove "Travel plan saved."
* Copy existing service:
** red "X"
** "Insert as copy" "use"
** in the preview: remove "Day X" and "0 image(s)"
** mark as copied service.
** search for service: 
*** priority: services from this travel plan
*** When services have an identical summary only show the newest of theses services but enable a button: show all
*** remove "Search existing booking services and insert a copy into this day."
*** "Copy existing service" --> "Existing services"
* Copy existing day, also with preview

* after adding a picture to a service, keep the service open, no jumping on the page

Travel plan PDF
==============
PDF personalization
- remove subtitle "Override the default customer-facing text when needed. Leave a field empty to use the derived default."
- Travel plan subtitle -> Subtitle below title
- horizontally center the web form submission

- Treat accomodation special: You will stay at:... near the day


Translate
=========
* Also Translate tour descriptions with openai

Travler
=======
* test! when clicking on the traveler, load the data from the backend. The traveler might have submitted his data.

emergency.html
=============
* Create model and storage space for practical tips and emergency numbers for each country. This information is not used at this point in time.
* Create a new backend menu item "emergency" with a red cross icon and allow atp_admin and atp_tour_editor users to edit this information.

offer
=====
* improve the input of currency amounts (VND no cents)

Welcome PDF
===========
* After accepting the offer (deposit paid) generate another "prepare yout journey" pdf that also includes travel documents with practical tips and emergency numbers. 

Other
=====
* Point out that personal data needs to be filled

* Suppliers!

* Index.html: FAQ formatting off

* rename the "Activities" section to "Activity logs"

## payments

ok, I want to move on to payments section in booking.html.
When the deposit paymen has been arrived, I am not sure if I want to we freeze the travel plan and the offer components. THis makes financu=ial sense, but I also want the tour to be flexible in the case unforseen events.


Freeze travel plan and offer after receiving deposit payment. In payments allow additional items with description to alter the travel plan. Allow creating a modified travel plan. 



# PDF texts
In the PDF texts section of each PDF generation, there is checkbox and a title for each text to the right of the title add a "select text" button. When pressed, show a pop-up that offers the following texts: A predefined AsiaTravelPlan standard text and all non-empty texts from the same field in the PDF texts in this booking.

# Use Subroutimes
PDF generation in the payment flow:
Do not re-implement the PDF generation in each step of the payment flow. Instead re-use javascript, html and CSS code.
Test: CSS change: visible in all PDF texts?

# Update page after payment plan change
When the payment plan changes, inject or remove the corresponding sections into booking.html withour the user needing to refresh the page.

# Deployment 
Button backend access
When logged in: show web page anf backend
When not logged in: do not show web page, show placeholder
Production keycloak

# Make a review
Conduct a comprehensive code review with a focus on payment flow and snapshots when a payment has been received. Where can the ATP staff see this snapshot?

Specifically:
	1.	PDF Storage & Structure
	•	Review how PDFs, temporary PDFs, and temp folders are organized in the backend.
	•	Evaluate naming conventions for PDF files and their relationship to booking IDs.
	•	Identify any inconsistencies, risks, or scalability issues in the current structure.
	2.	Backend ↔ Frontend Consistency
	•	Verify that PDF locations, naming, and states (temporary vs. final) are correctly handled and reflected in the frontend.
	•	Check for potential mismatches, edge cases, or user-facing issues.
	3.	Review of Today’s Changes
	•	Analyze all code changes made today.
	•	Identify potential bugs, regressions, or design issues introduced.
	4.	Recommendations
	•	Propose improvements for structure, naming, and data flow.
	•	Suggest best practices for maintainability, scalability, and clarity.
	•	Highlight any technical debt or areas that should be refactored.


# payment plan exceeds total amount???



# PDFs

I want to treat the Request payment PDFs and Confirm payment PDF different for the deposit payment step:
The Request payment should a friendly document structured as follows:

- Header as always
- Tour title, picture and number of days
- First-page guide section
- Friendly worded table with deposit, optional installments and final payment and total amount
- Friendly worded text: "We would be thrilled if you book this tour with us. Please pay the deposit to confirm your booking". Make this text editable in the PDF texts section in the Deposit financial step.
- a text: Please find your travel plan at the end of this PDF.
- final words (best regards, etc)
- Bage break and Travel plan
