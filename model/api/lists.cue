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
}

#TourDetail: {
	tour: entities.#Tour
}
