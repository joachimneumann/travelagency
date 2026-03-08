package enums

CurrencyCatalog: [
	{
		code:          "USD"
		displaySymbol: "$"
		decimalPlaces: 2
	},
	{
		code:          "EURO"
		displaySymbol: "€"
		decimalPlaces: 2
	},
	{
		code:          "VND"
		displaySymbol: "₫"
		decimalPlaces: 0
	},
	{
		code:          "THB"
		displaySymbol: "฿"
		decimalPlaces: 0
	},
]

#CurrencyCode: or([for currency in CurrencyCatalog {currency.code}])
#CurrencyDisplaySymbol: or([for currency in CurrencyCatalog {currency.displaySymbol}])

#CurrencyDefinition: {
	code:          #CurrencyCode
	displaySymbol: #CurrencyDisplaySymbol
	decimalPlaces: 0 | 2
}

#CurrencyMeta: {
	for currency in CurrencyCatalog {
		"\(currency.code)": {
			code:          currency.code
			displaySymbol: currency.displaySymbol
			decimalPlaces: currency.decimalPlaces
		}
	}
}
