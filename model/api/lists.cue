package api

import entities "travelagency.local/model/entities"

#BookingList: {
	items: [...entities.#Booking]
	pagination: #Pagination
}

#TourList: {
	items: [...entities.#Tour]
	pagination: #Pagination
}

#BookingDetail: {
	booking: entities.#Booking
}

#TourDetail: {
	tour:    entities.#Tour
	options: #TourOptions
}
