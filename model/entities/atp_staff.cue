package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#AtpStaffExperience: {
	id?:     common.#Identifier
	title:   string & !=""
	summary: string & !=""
	countries?: [...enums.#CountryCode]
	travel_styles?: [...enums.#TourStyleCode]
}

#AtpStaffProfile: {
	username:     string & !=""
	name?:        string
	picture_ref?: string
	spoken_languages: [...enums.#LanguageCode]
	experiences?: [...#AtpStaffExperience]
}
