package api

import entities "travelagency.local/model/entities"

#BookingList: {
	items: [...entities.#Booking]
	pagination: #Pagination
	filters?:   #BookingListFilters
	sort?:      string
}

#TourList: {
	items: [...entities.#Tour]
	pagination: #Pagination
	filters?:   #TourListFilters
	sort?:      string
	available_destinations?: [...string]
	available_styles?: [...string]
}

#BookingDetail: {
	booking:    entities.#Booking
	unchanged?: bool
}

#TourDetail: {
	tour:    entities.#Tour
	options: #TourOptions
}
