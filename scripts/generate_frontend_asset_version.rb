#!/usr/bin/env ruby
# frozen_string_literal: true

require 'digest'
require 'pathname'

ROOT = Pathname.new(File.expand_path('..', __dir__))

VERSION_SOURCE_GLOBS = [
  'frontend/pages/**/*.html',
  'frontend/scripts/**/*.js',
  'frontend/Generated/**/*.js',
  'shared/css/**/*.css',
  'shared/generated-contract/**/*.js'
].freeze

TARGET_GLOBS = [
  'frontend/pages/**/*.html',
  'frontend/scripts/**/*.js',
  'frontend/Generated/**/*.js'
].freeze

CSS_PATH_PATTERN = /((?:\/)?assets\/css\/styles\.css)(?:\?v=[A-Za-z0-9._-]+)?/
STATIC_ASSET_VERSION_PATTERN = /((?:\/)?assets\/[^"']+\.(?:webp|png|svg|jpg|jpeg|mp4|webm))\?v=[A-Za-z0-9._-]+/
MODULE_PATH_PATTERN = /((?:\/frontend\/scripts\/[^"'?\s>]+\.js|frontend\/scripts\/[^"'?\s>]+\.js|(?:\.\.?\/)+(?:Generated\/API\/generated_API(?:RequestFactory|Runtime)\.js|booking\/[^"'?\s>]+\.js|shared\/[^"'?\s>]+\.js|pages\/[^"'?\s>]+\.js|[^"'?\s>\/]+\.js)|\.\.?\/\.\.?\/\.\.?\/shared\/generated-contract\/API\/generated_API(?:RequestFactory|Runtime)\.js))(?:\?v=[A-Za-z0-9._-]+)?/

def normalize_for_digest(content)
  content.gsub(/\?v=[A-Za-z0-9._-]+/, '')
end

def matching_files(globs)
  globs.flat_map { |pattern| Dir.glob(ROOT.join(pattern).to_s) }.map { |entry| Pathname.new(entry) }.uniq.sort
end

def compute_version
  digest = Digest::SHA256.new
  matching_files(VERSION_SOURCE_GLOBS).each do |file_path|
    digest.update(file_path.relative_path_from(ROOT).to_s)
    digest.update("\0")
    digest.update(normalize_for_digest(file_path.read))
    digest.update("\0")
  end
  digest.hexdigest[0, 12]
end

def update_file(file_path, version)
  original = file_path.read
  updated = original
    .gsub(CSS_PATH_PATTERN) { "#{$1}?v=#{version}" }
    .gsub(STATIC_ASSET_VERSION_PATTERN) { "#{$1}?v=#{version}" }
    .gsub(MODULE_PATH_PATTERN) { "#{$1}?v=#{version}" }
  return false if updated == original

  file_path.write(updated)
  true
end

version = compute_version
changed_files = matching_files(TARGET_GLOBS).select { |file_path| update_file(file_path, version) }

puts "Generated frontend asset version #{version}"
puts "Updated #{changed_files.length} file(s)"
