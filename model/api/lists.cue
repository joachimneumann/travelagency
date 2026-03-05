package api

import entities "travelagency.local/model/entities"

#BookingList: {
	items: [...entities.#Booking]
	pagination: #Pagination
}

#CustomerList: {
	items: [...entities.#Customer]
	pagination: #Pagination
}

#TourList: {
	items: [...entities.#Tour]
	pagination: #Pagination
}

#BookingDetail: {
	booking:   entities.#Booking
	customer?: entities.#Customer
}

#CustomerDetail: {
	customer: entities.#Customer
	bookings: [...entities.#Booking]
	consents: [...entities.#CustomerConsent]
	documents: [...entities.#CustomerDocument]
	travelGroups: [...entities.#TravelGroup]
	travelGroupMembers: [...entities.#TravelGroupMember]
}

#TourDetail: {
	tour:    entities.#Tour
	options: #TourOptions
}
