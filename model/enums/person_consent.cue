package enums

PersonConsentTypeCatalog: [
	"privacy_policy",
	"marketing_email",
	"marketing_whatsapp",
	"profiling",
]

#PersonConsentType: or(PersonConsentTypeCatalog)

PersonConsentStatusCatalog: [
	"granted",
	"withdrawn",
	"unknown",
]

#PersonConsentStatus: or(PersonConsentStatusCatalog)
