package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#AtpStaffExperience: {
	id?:     common.#Identifier
	title:   string & !=""
	summary: string & !=""
}

#AtpStaffProfile: {
	username:     string & !=""
	name?:        string
	picture_ref?: string
	languages: [...enums.#LanguageCode]
	destinations?: [...enums.#CountryCode]
	experiences?: [...#AtpStaffExperience]
}
