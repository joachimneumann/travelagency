package enums

PersonConsentTypeCatalog: [
	"privacy_policy",
	"marketing_email",
	"profiling",
]

#PersonConsentType: or(PersonConsentTypeCatalog)

PersonConsentStatusCatalog: [
	"granted",
	"withdrawn",
	"unknown",
]

#PersonConsentStatus: or(PersonConsentStatusCatalog)
