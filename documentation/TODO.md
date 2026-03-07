DONE, but not checked
=====================

- When editing the content, but not saved yet, change background of the section that needs saving to 15% transparent with the color of the update button. 

- Check if conflict avoidance is correctly implemented. When a frontend or iOS get a dataset for a customer, group or booking, it also gets a hash of that data. When the user wants to save / update the data, send the hash of the lastly read data together with the changed data. The server will reject the edit if the hash does not match the hash of the data at the time of the update request. 
Web page: number of persons?

Not DONE
=====================
- destinations and travel style: allow multible selections
- destinations and travel style move this onto the hero image, below the "Private holidays in Vietnam, Thailand, Cambodia and Laos" title. Rename "clear filters" to "show all tours"

- I want to allow a booking to have a group as customer. Should we use a new name for this entity? 
- Make these changes in the model and maintain the documentation and all code consistent with this change.

- add a button to delete a booking.
- add a button to delete a customer. Only allow this if the customer is ont in any group or in any booking. Show a human readable error message if this is the case.
- add a button to remove a member from a group. make sure that the group assignments are updated in the customer info (backend and frontend) 
- add a button to delete a group. Only allow this only if the number of group members is 0.
-  Ask for confirmation for all delete actions.

- Buy phone number!!!

- Web page: number of persons?

- WhatsApp:
    - allow staff to answer messages in frontend and in app
    - Receive and send photos/videos and files
    - Store received photos/videos and files and allow the atp staff to download them to phone / computer