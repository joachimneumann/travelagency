package entities

import (
	common "travelagency.local/model/common"
	enums "travelagency.local/model/enums"
)

#Supplier: {
	id:              common.#Identifier
	name:            string
	contact?:        string
	emergency_phone?: string
	email?:          common.#Email
	country?:        enums.#CountryCode
	category:        enums.#SupplierCategory
}
