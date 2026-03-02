package common

import enums "travelagency.local/model/enums"

#MoneyAmount: {
	currency: enums.#CurrencyCode
	minor:    int
}

#NonNegativeMoneyAmount: #MoneyAmount & {
	minor: >=0
}
