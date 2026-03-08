DONE, but not tested
=====================

- Check if conflict avoidance is correctly implemented. When a frontend or iOS get a dataset for a customer, group or booking, it also gets a hash of that data. When the user wants to save / update the data, send the hash of the lastly read data together with the changed data. The server will reject the edit if the hash does not match the hash of the data at the time of the update request. 
Web page: number of travelers?

- Allow a booking to have a travel_group or a customer as client.

I would like to change the datastructure.
client should be minimal, only one containing:
id: common.#Identifier
client_type: enums.#ClientType
id_of_client: common.#Identifier

The apps would then need to read the display_name:, phone_number and email from id_of_client.
if id_of_client points to a customer, the information is there. if id_of_client points to a travel_grup, the information is in the group contact.


Not DONE
========

- add a button to delete a booking.
- add a button to delete a customer. Only allow this if the customer is ont in any group or in any booking. Show a human readable error message if this is the case.
- add a button to remove a member from a group. make sure that the group assignments are updated in the customer info (backend and frontend) 
- add a button to delete a group. Only allow this only if the number of group members is 0.
-  Ask for confirmation for all delete actions.

- Buy phone number!!!

- WhatsApp:
    - allow staff to answer messages in frontend and in app
    - Receive and send photos/videos and files
    - Store received photos/videos and files and allow the atp staff to download them to phone / computer

clean model:
travelGroupOptions

remove from model?
==================
idempotencyKey