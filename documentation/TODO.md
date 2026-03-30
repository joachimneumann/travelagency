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

translation of backend texts
============================
When an english backend text changes in frontend/data/i18n/backend/en.json (like for example booking.travel_plan.day_notes recently), how can I make sure that the vietnamese backend texts are also updated wuth the corresponding translation? In these two backend files en.json and vi.json english is always the master and vietnamese is derrived by translation from english. Should we have a translate script? Add timestamps of edits? Add a dirty boolean to vi when an english text changes? Always translate immidiately or clean up after wards?

Scrolling
=========
add a shadow to make scrolling enter below the sticky bar, gradually fading our over 20px (scrolling.png)

Booking Hero
============
* title font: remove font-family from booking-hero__name  Note: this should revert to var(--font-family-sans);
* Hero subtitle: last updated {value} last updated 4 day(s) ago

Travler
=======
* when clicking on the traveler, load the data from the backend. The traveler might have submitted his data.
* 1 traveling: Joachim Neumann (Primary contact) --> 1 Traveler: Joachim Neumann
* "The web form indicates 2 travelers, but this booking currently has one traveler only." -> "The web form indicated 2 travelers"

Travel Plan Colors
===================
1.
* rename --info-surface-alpha to --travelplan_day_color
* Rename --success-surface-alpha to --travelplan_service_color;
2.
* set travelplan_day_color to rgba(12, 99, 180, 0.25);
* set travelplan_service_color to rgba(12, 99, 180, 0.25);

Travel Plan
===========
Service in the same blue as day now
* Travel Plan subtitle: 2 days · 3 services · 1 uncovered --> 2 days · 3 services
* --travel-plan-content-offset --> 5rem
* Customer-facing additional notes about this day -> Notes about the day
* Day title: day as text, Summary, overnight, X services

Service
=======
* Move the picture up, to the right of Summary: Service provided. use placeholder picture. to change: clickable as in ATP staff profile picture editing.
* Look at the source code. Where is the Service Kind element used? 
  If only accomodation, replace the service kind with a with "multi-day" checkbox (and consequently a "days" numberic textfield).
* Location (optional)
* Service title -> Summary: Service provided
* Time information -> When?
* time range: improve layout (time_range.png)
* Details -> Notes about the Service
* "Supplier / financial note (ATP internal) -> ATP internal Notes> placeholder: "Supplier information / Financial notes"


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

Tours
=====
change picture as in ATP staff profile picture editing.

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
