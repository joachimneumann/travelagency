package api

import entities "travelagency.local/model/entities"

#BookingList: {
	items: [...#BookingReadModel]
	pagination: #Pagination
	filters?:   #BookingListFilters
	sort?:      string
}

#TourList: {
	items: [...entities.#Tour]
	pagination: #Pagination
	filters?:   #TourListFilters
	sort?:      string
	available_destinations?: [...#CatalogOption]
	available_styles?: [...#CatalogOption]
}

#BookingDetail: {
	booking:    #BookingReadModel
	unchanged?: bool
}

#TourDetail: {
	tour:    entities.#Tour
	options: #TourOptions
}
