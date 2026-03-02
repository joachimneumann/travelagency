package enums

#CurrencyCode: "USD" | "EURO" | "VND" | "THB"

#CurrencyDisplaySymbol: "$" | "€" | "₫" | "฿"

#CurrencyDefinition: {
	code:          #CurrencyCode
	displaySymbol: #CurrencyDisplaySymbol
	decimalPlaces: 0 | 2
}

#CurrencyMeta: {
	USD: {
		code:          "USD"
		displaySymbol: "$"
		decimalPlaces: 2
	}
	EURO: {
		code:          "EURO"
		displaySymbol: "€"
		decimalPlaces: 2
	}
	VND: {
		code:          "VND"
		displaySymbol: "₫"
		decimalPlaces: 0
	}
	THB: {
		code:          "THB"
		displaySymbol: "฿"
		decimalPlaces: 0
	}
}

CurrencyCatalog: [
	#CurrencyMeta.USD,
	#CurrencyMeta.EURO,
	#CurrencyMeta.VND,
	#CurrencyMeta.THB,
]
