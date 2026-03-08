package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#Client: {
	id:               common.#Identifier
	client_type:      enums.#ClientType
	customer_id?:     common.#Identifier
	travel_group_id?: common.#Identifier
	client_hash:      string
}
