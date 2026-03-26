package entities

import (
	enums "travelagency.local/model/enums"
)

#AtpStaffLocalizedTextEntry: {
	lang:  enums.#LanguageCode
	value: string & !=""
}

#AtpStaffProfile: {
	username:     string & !=""
	name?:        string
	full_name?:   string
	position?:    string
	position_i18n?: [...#AtpStaffLocalizedTextEntry]
	friendly_short_name?: string
	picture_ref?: string
	languages: [...enums.#LanguageCode]
	destinations?: [...enums.#CountryCode]
	appears_in_team_web_page?: *true | bool
	qualification?: string
	qualification_i18n?: [...#AtpStaffLocalizedTextEntry]
	description?: string
	description_i18n?: [...#AtpStaffLocalizedTextEntry]
	mobile_description?: string
	mobile_description_i18n?: [...#AtpStaffLocalizedTextEntry]
}
