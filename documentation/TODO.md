# TODO

#regions

create a document documentation/concept/areas_amd_places.md:

I want to add destination areas and places to the travel plan in the marketing tours and to the travel plan in bookings.
Create a document documentation/concept/areas_and_places.md

Areas are sub-categories to destinations. 
Areas have optional places

for example:
destination: Vietnam
area: central
place: Hoi An

The list of possible areas and places shall be stored in the backend, not in the content folder.
It shall be possible to add areas to destinations in the tour editor marketing_tours.html
It shall be possible to add places to areas in the tour editor marketing_tours.html

In marketing_tour.html, staff can select one or more destinations and can additionaly select an one or more areas of all selected destinations and can select select an one or more places of each selected area.

do not implement yet.


Translate
=========
* Translate with openai

Traveler
=======
* test! when clicking on the traveler, load the data from the backend. The traveler might have submitted his data.

Translation
===========
- global translation cache for customer (17 languages)
- global translation cache for staff (EN/VI)
- global translation override for customer (17 languages)
- global translation override for staff (EN/VI)
All searchable and editable

Pictures in marketing_tours
===========================
Remove pictures from top, add a [] Use Checkbox in the service picture

emergency.html
=============
* Create model and storage space for practical tips and emergency numbers for each country. This information is not used at this point in time.
* Create a new backend menu item "emergency" with a red cross icon and allow atp_admin and atp_tour_editor users to edit this information.

offer
=====
* improve the input of currency amounts (VND no cents)

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
