package api

import common "travelagency.local/model/common"

#Pagination: {
	page:        >=1 & int
	page_size:   >=1 & int
	total_items: >=0 & int
	total_pages: >=1 & int
}

#PaginatedRequest: {
	page?:      >=1 & int
	page_size?: >=1 & int
	sort?:      string
	query?:     string
}

#ErrorResponse: {
	error:       string & !=""
	detail?:     string
	code?:       string
	request_id?: common.#Identifier
}

#TranslationEntry: {
	key:   string & !=""
	value: string & !=""
}
