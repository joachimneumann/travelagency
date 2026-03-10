package api

#FeatureFlags: {
	bookings: bool
	tours:    bool
}

#MobileAppVersionGate: {
	min_supported_version: string & !=""
	latest_version:        string & !=""
	force_update:          bool
}

#APIContractVersion: {
	contract_version: string & !=""
}

#MobileBootstrap: {
	app:      #MobileAppVersionGate
	api:      #APIContractVersion
	features: #FeatureFlags
}
