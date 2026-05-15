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

#TourVariantList: {
	items: [...#TourVariantReadModel]
	pagination: #Pagination
	filters?:   #TourVariantListFilters
	sort?:      string
	options?:   #TourVariantOptions
}

#BookingDetail: {
	booking:    #BookingReadModel
	unchanged?: bool
}

#TourDetail: {
	tour:    jsonModel.#Tour
	options: #TourOptions
}

#TourVariantDetail: {
	tour_variant: #TourVariantReadModel
	options:      #TourVariantOptions
}
