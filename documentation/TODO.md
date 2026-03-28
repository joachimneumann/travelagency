# in progress

Remove stage as a drop down from booking.html. Instead add buttons such as travel plan sent to customer, offer sent to customer, deposit received, etc. 
Then Automatically derive the stage and write a description of the stage and last action at the top of the booking.html page. for example: "Offer sent to customer. Waiting for deposit"

# TODO

"Your ATP guide xxx" section when creating the PDF:
- rephrase to "Assisted by our team member xxx"
- when the Qualification is empty in the atps_staff, use the mobile description

* atp_admin can not be assigned to a booking, only atp_staff

# tour guide / ATP staff

* in traveler-details.html:
- after "Send traveler details to Asia Travel Plan" the confirmation should be "Your details have been transmitted to AsiaTravePlan".
- If nationality is VI: keep the cice between Passport and ID card.
- If the nationality is different: change the title "Travel document" to "Passport" and remove the ID card option
- Allow uploading a picture of the passport or ID card

* in booking.html when clicking on the traveler, load the data from the backend. THe traveler might have submitted his data.

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
