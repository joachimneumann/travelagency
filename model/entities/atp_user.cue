package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#ATPUser: {
	id:                common.#Identifier
	preferredUsername: string & !=""
	displayName?:      string
	email?:            common.#Email
	roles: [...enums.#ATPUserRole]
	staffId?:   common.#Identifier
	active?:    bool
	createdAt?: common.#Timestamp
	updatedAt?: common.#Timestamp
}
