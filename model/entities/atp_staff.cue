package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#ATPStaff: {
	id:                 common.#Identifier
	preferred_username: string & !=""
	display_name?:      string
	email?:             common.#Email
	roles:              [...enums.#ATPStaffRole]
	staff_id?:          common.#Identifier
	active?:            bool
	created_at?:        common.#Timestamp
	updated_at?:        common.#Timestamp
}
