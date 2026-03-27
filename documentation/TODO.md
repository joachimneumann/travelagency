# in progress

Remove stage as a drop down from booking.html. Instead add buttons such as travel plan sent to customer, offer sent to customer, deposit received, etc. 
Then Automatically derive the stage and write a description of the stage and last action at the top of the booking.html page. for example: "Offer sent to customer. Waiting for deposit"

# TODO

Add a new section on Booking HTML just above the travel plan with the internal offer detail level that allows the atp_staff to choose between the three internal offer detail levels (trip, day and component). Don't make this a collapsible section but rather one big pill where only one of the three can and must be active (like a 3 state toggle button). The default is trip.
exactly one internal offer detail is active at any time and the other two are deactivated. When switching to a coarser granularity, show a modal pop-up warning that indicates that offer details will be aggregated and lost. 
Below show another equally designed selector: customer facing offer detail level, which must be coarser than the internal one.



* request passport/ID card (vietnamese only) picture

* in traveler-details.html, after "Send traveler details to Asia Travel Plan" the confirmation should be "your data has been sent to AsiaTravePlan".

* In the traveler details, show ID card only when the nationality of the traveler is Vietnamese. Otherwise, remove the pill that allows you to switch between passport and ID, and just replace the title "travel document" with "passport". 

* in booking.html when clicking on the traveler, load the data from the backend. THe traveler might have submitted his data.

* add food preferences and allergies to persons

* add hotel room preference: Single Double

* Create model and storage space for practical tips and emergency numbers for each country. This information is not used at this point in time.

* After accepting the offer (deposit paid) generate another pdf that also includes travel documents with practical tips and emergency numbers. 

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
