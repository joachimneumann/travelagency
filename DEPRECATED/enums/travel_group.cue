package enums

TravelGroupTypeCatalog: [
	"family",
	"friends",
	"corporate",
	"school",
	"other",
]

#TravelGroupType: or(TravelGroupTypeCatalog)

TravelGroupMemberRoleCatalog: [
	"TravelGroupContact",
	"decision_maker",
	"payer",
	"assistant",
	"other",
]

#TravelGroupMemberRole: or(TravelGroupMemberRoleCatalog)
