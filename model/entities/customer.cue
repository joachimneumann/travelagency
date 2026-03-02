package entities

import common "travelagency.local/model/common"

#Customer: {
	id:         common.#Identifier
	name?:      string
	email?:     common.#Email
	phone?:     string
	language?:  string
	createdAt?: common.#Timestamp
	updatedAt?: common.#Timestamp
}
