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
	{
		code:          "CNY"
		displaySymbol: "CN¥"
		decimalPlaces: 2
	},
	{
		code:          "JPY"
		displaySymbol: "¥"
		decimalPlaces: 0
	},
	{
		code:          "KRW"
		displaySymbol: "₩"
		decimalPlaces: 0
	},
	{
		code:          "RUB"
		displaySymbol: "₽"
		decimalPlaces: 2
	},
	{
		code:          "PLN"
		displaySymbol: "zł"
		decimalPlaces: 2
	},
	{
		code:          "DKK"
		displaySymbol: "kr"
		decimalPlaces: 2
	},
	{
		code:          "SEK"
		displaySymbol: "kr"
		decimalPlaces: 2
	},
	{
		code:          "NOK"
		displaySymbol: "kr"
		decimalPlaces: 2
	},
	{
		code:          "AUD"
		displaySymbol: "A$"
		decimalPlaces: 2
	},
	{
		code:          "GBP"
		displaySymbol: "£"
		decimalPlaces: 2
	},
	{
		code:          "NZD"
		displaySymbol: "NZ$"
		decimalPlaces: 2
	},
	{
		code:          "ZAR"
		displaySymbol: "R"
		decimalPlaces: 2
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
