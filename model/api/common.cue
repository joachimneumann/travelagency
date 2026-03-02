package api

import common "travelagency.local/model/common"

#Pagination: {
	page:       >=1 & int
	pageSize:   >=1 & int
	totalItems: >=0 & int
}

#PaginatedRequest: {
	page?:     >=1 & int
	pageSize?: >=1 & int
	sort?:     string
	query?:    string
}

#ErrorResponse: {
	error:      string & !=""
	detail?:    string
	code?:      string
	requestId?: common.#Identifier
}
