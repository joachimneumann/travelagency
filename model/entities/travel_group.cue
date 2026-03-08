package entities

import common "travelagency.local/model/common"

#TravelGroup: {
	id:                         common.#Identifier
	client_id:                  common.#Identifier
	travel_group_hash?:         string
	group_name:                 string
	group_contact_customer_id?: common.#Identifier
	traveler_customer_ids: [...common.#Identifier]
	travel_month?:        string
	number_of_travelers?: >=common.#MinTravelers & <=common.#MaxTravelers & int
	notes?:               string
	created_at:           common.#Timestamp
	updated_at:           common.#Timestamp
	archived_at?:         common.#Timestamp
}
