#!/usr/bin/env ruby
require 'fileutils'
require 'xcodeproj'

ROOT = File.expand_path(__dir__)
PROJECT_PATH = File.join(ROOT, 'AsiaTravelPlan.xcodeproj')
PROJECT_NAME = 'AsiaTravelPlan'
BUNDLE_ID = 'com.asiatravelplan.ios'

FileUtils.rm_rf(PROJECT_PATH)
project = Xcodeproj::Project.new(PROJECT_PATH)
project.root_object.attributes['LastSwiftUpdateCheck'] = '2600'
project.root_object.attributes['LastUpgradeCheck'] = '2600'

app_target = project.new_target(:application, PROJECT_NAME, :ios, '17.0')
app_target.product_name = PROJECT_NAME

app_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = BUNDLE_ID
  config.build_settings['PRODUCT_NAME'] = PROJECT_NAME
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['INFOPLIST_FILE'] = 'Resources/Info.plist'
  config.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  config.build_settings['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['MARKETING_VERSION'] = '1.0'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['DEVELOPMENT_ASSET_PATHS'] = '"Resources/Assets.xcassets"'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  config.build_settings['ENABLE_PREVIEWS'] = 'YES'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks'
end

main_group = project.main_group
main_group.clear
app_group = main_group.new_group(PROJECT_NAME, '')
models_group = app_group.new_group('Models', 'Models')
services_group = app_group.new_group('Services', 'Services')
view_models_group = app_group.new_group('ViewModels', 'ViewModels')
views_group = app_group.new_group('Views', 'Views')
resources_group = app_group.new_group('Resources', 'Resources')

[
  'AppConfig.swift',
  'AsiaTravelPlanApp.swift'
].each do |file|
  ref = app_group.new_file(file)
  app_target.add_file_references([ref])
end

Dir.glob(File.join(ROOT, 'Models', '*.swift')).sort.each do |file|
  ref = models_group.new_file(File.basename(file))
  app_target.add_file_references([ref])
end

Dir.glob(File.join(ROOT, 'Services', '*.swift')).sort.each do |file|
  ref = services_group.new_file(File.basename(file))
  app_target.add_file_references([ref])
end

Dir.glob(File.join(ROOT, 'ViewModels', '*.swift')).sort.each do |file|
  ref = view_models_group.new_file(File.basename(file))
  app_target.add_file_references([ref])
end

Dir.glob(File.join(ROOT, 'Views', '*.swift')).sort.each do |file|
  ref = views_group.new_file(File.basename(file))
  app_target.add_file_references([ref])
end

['Assets.xcassets'].each do |file|
  ref = resources_group.new_file(file)
  app_target.resources_build_phase.add_file_reference(ref)
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(app_target, nil)
scheme.save_as(PROJECT_PATH, PROJECT_NAME, true)
