package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#CountryEmergencyContact: {
	label: string & !=""
	phone: string & !=""
	note?: string
}

#CountryPracticalInfo: {
	country: enums.#CountryCode
	published_on_webpage: *true | bool
	practical_tips: [...string]
	emergency_contacts: [...#CountryEmergencyContact]
	updated_at?: common.#Timestamp
}
