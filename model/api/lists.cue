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
	submittedCustomer?: #BookingSubmittedCustomer
	customerCandidates?: [...#BookingCustomerCandidate]
	travelGroupOptions?: [...#TravelGroupOption]
}

#BookingClientDetail: {
	booking:      entities.#Booking
	client?:      entities.#ClientSummary
	customer?:      entities.#Customer
	travelGroup?: entities.#TravelGroup
	submittedCustomer?: #BookingSubmittedCustomer
	customerCandidates?: [...#BookingCustomerCandidate]
	travelGroupOptions?: [...#TravelGroupOption]
	members?:     [...entities.#TravelGroupMember]
	memberCustomers?: [...entities.#Customer]
}

#BookingSubmittedCustomer: {
	name?:         string
	email?:        string
	phone_number?: string
}

#BookingCustomerCandidate: {
	customer_client_id:           string
	name:                         string
	email?:                       string
	phone_number?:                string
	confidence?:                  string
	reasons?:                     [...string]
}

#TravelGroupOption: {
	travel_group_id:  string
	client_id:        string
	group_name:       string
	preferred_language?: string
	preferred_currency?: string
	timezone?:        string
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
