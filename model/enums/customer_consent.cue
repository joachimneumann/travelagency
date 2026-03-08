package enums

CustomerConsentTypeCatalog: [
	"privacy_policy",
	"marketing_email",
	"marketing_whatsapp",
	"profiling",
]

#CustomerConsentType: or(CustomerConsentTypeCatalog)

CustomerConsentStatusCatalog: [
	"granted",
	"withdrawn",
	"unknown",
]

#CustomerConsentStatus: or(CustomerConsentStatusCatalog)
