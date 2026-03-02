package api

#FeatureFlags: {
	bookings:  bool
	customers: bool
	tours:     bool
}

#MobileAppVersionGate: {
	minSupportedVersion: string & !=""
	latestVersion:       string & !=""
	forceUpdate:         bool
}

#APIContractVersion: {
	contractVersion: string & !=""
}

#MobileBootstrap: {
	app:      #MobileAppVersionGate
	api:      #APIContractVersion
	features: #FeatureFlags
}
