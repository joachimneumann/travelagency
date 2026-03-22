# TODO



break dronw the large js files 
frontend/scripts/booking/offers.js
frontend/scripts/main.js
frontend/scripts/booking/travel_plan.js
frontend/scripts/pages/booking.js




ok, I want to move on to payments.
When the payment terms have been decided and an offer is accepted, create the initial payments in the payments section.
However, the payments can be altered. Additional Discounts can be given, additional surcharge can be added. A payment processing fee can be added applied.


in the segments change the title "Link offer component" to "add coffer component"

Payment terms: make the title "Note for customer" smaller

I want the label to be Add offer component

Payment terms: make the title "Note for customer" in the same font as "Segment title" in the travel plan segments 

the messages, e.g., transation statu, always as text withut pill sourounding the text. Color of text gray, except for errors, which should be red

Work on the abstraction of the collapsable section.
Create an UI element "section" or "Section", that is based on the current section header and section content. A section is always collapsable, but it has an optional delete button, which is placed next to the collapse / expand charcter. The delete button triggers a modeal confirmation window before deleteing the complete content of the Section.

The high level sections "travelling", "travel plan", offer", etc. do not have a delete buttons. But they might later contain other sections that have the delete button.




