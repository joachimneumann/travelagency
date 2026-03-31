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

Scrolling
=========
add a shadow to make scrolling enter below the sticky bar, gradually fading our over 20px (scrolling.png)

* Translate tour descriptino with openai

Travler
=======
* test! when clicking on the traveler, load the data from the backend. The traveler might have submitted his data.

emergency.html
=============
* Create model and storage space for practical tips and emergency numbers for each country. This information is not used at this point in time.
* Create a new backend menu item "emergency" with a red cross icon and allow atp_admin and atp_tour_editor users to edit this information.

offer
=====
* input of currency amounts (VND no cents)

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


# review


Conduct a comprehensive code review with a focus on travel plan, offer components and offer acceptance 

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
