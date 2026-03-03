package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#ATPStaff: {
	id:                common.#Identifier
	preferredUsername: string & !=""
	displayName?:      string
	email?:            common.#Email
	roles: [...enums.#ATPStaffRole]
	staffId?:   common.#Identifier
	active?:    bool
	createdAt?: common.#Timestamp
	updatedAt?: common.#Timestamp
}
