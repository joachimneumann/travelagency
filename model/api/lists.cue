package api

import jsonModel "travelagency.local/model/json"

#BookingList: {
	items: [...#BookingReadModel]
	pagination: #Pagination
	filters?:   #BookingListFilters
	sort?:      string
}

#TourList: {
	items: [...jsonModel.#Tour]
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
	tour:    jsonModel.#Tour
	options: #TourOptions
}
