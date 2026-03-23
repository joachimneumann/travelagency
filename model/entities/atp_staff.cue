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
	picture_ref?: string
	languages: [...enums.#LanguageCode]
	destinations?: [...enums.#CountryCode]
	qualification?: string
	qualification_i18n?: [...#AtpStaffLocalizedTextEntry]
}
