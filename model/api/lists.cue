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
	booking:      entities.#Booking
	client?:      entities.#ClientSummary
	customer?:      entities.#Customer
	travelGroup?: entities.#TravelGroup
}

#BookingClientDetail: {
	booking:      entities.#Booking
	client?:      entities.#ClientSummary
	customer?:      entities.#Customer
	travelGroup?: entities.#TravelGroup
	members?:     [...entities.#TravelGroupMember]
	memberCustomers?: [...entities.#Customer]
}

#CustomerDetail: {
	client: entities.#Client
	customer: entities.#Customer
	bookings: [...entities.#Booking]
	consents: [...entities.#CustomerConsent]
	documents: [...entities.#CustomerDocument]
	travelGroups: [...entities.#TravelGroup]
	travelGroupMembers: [...entities.#TravelGroupMember]
}

#TravelGroupList: {
	items: [...entities.#TravelGroup]
	pagination: #Pagination
}

#TravelGroupDetail: {
	client: entities.#Client
	travelGroup: entities.#TravelGroup
	members: [...entities.#TravelGroupMember]
	memberCustomers: [...entities.#Customer]
}

#TourDetail: {
	tour:    entities.#Tour
	options: #TourOptions
}
