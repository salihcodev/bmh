// @ts-check
// Resolve @expo/config-plugins through expo to work with pnpm's strict isolation
const { withDangerousMod } = require(
  require.resolve('@expo/config-plugins', {
    paths: [require.resolve('expo/package.json')],
  })
);
const fs = require('fs');
const path = require('path');

/**
 * Injects `$RNFirebaseDisableSPM = true` into the iOS Podfile so that
 * react-native-firebase uses CocoaPods instead of SPM for Firebase
 * dependencies. Without this, static linkage causes duplicate-symbol errors.
 *
 * This runs automatically during `expo prebuild` and survives `--clean` rebuilds.
 *
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
const withRNFirebaseDisableSPM = (config) =>
  withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'Podfile',
      );

      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // 1 — disable SPM
      if (!contents.includes('$RNFirebaseDisableSPM')) {
        contents = contents.replace(
          'prepare_react_native_project!',
          [
            'prepare_react_native_project!',
            '',
            '# react-native-firebase: disable SPM resolution to avoid duplicate-symbol',
            '# link errors caused by static linkage + automatic library products.',
            '# NOTE: injected by plugins/withRNFirebaseDisableSPM.js — do not remove.',
            '$RNFirebaseDisableSPM = true',
          ].join('\n'),
        );
      }

      // 2 — modular headers for Firebase Swift interop pods (required when SPM is disabled)
      if (!contents.includes('FirebaseAppCheckInterop')) {
        contents = contents.replace(
          'use_native_modules!(config_command)',
          [
            'use_native_modules!(config_command)',
            '',
            '  # firebase-ios-sdk Swift interop pods need module maps for static linkage.',
            "  pod 'FirebaseAppCheckInterop',  :modular_headers => true",
            "  pod 'FirebaseAuthInterop',      :modular_headers => true",
            "  pod 'FirebaseMessagingInterop', :modular_headers => true",
            "  pod 'FirebaseFirestoreInternal',:modular_headers => true",
          ].join('\n'),
        );
      }

      fs.writeFileSync(podfilePath, contents);

      return modConfig;
    },
  ]);

module.exports = withRNFirebaseDisableSPM;
