import type { ConfigContext, ExpoConfig } from 'expo/config';

const env = process.env;

const isProd = env.APP_ENV === 'production';
const name = env.APP_NAME ?? (isProd ? 'Be My Hand' : 'Be My Hand (Dev)');
const slug = env.APP_SLUG ?? 'be-my-hand';
const scheme = env.APP_SCHEME ?? 'bemyhand';
const bundleId = env.APP_BUNDLE_ID ?? (isProd ? 'com.salihcodev.bemyhand' : 'com.salihcodev.bemyhand.dev');
const googleServicesDir = isProd ? './firebase/prod' : './firebase/dev';
const googleServicesAndroid = env.GOOGLE_SERVICES_JSON ?? `${googleServicesDir}/google-services.json`;
const googleServicesIos = env.GOOGLE_SERVICES_PLIST ?? `${googleServicesDir}/GoogleService-Info.plist`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name,
  slug,
  scheme,
  version: '1.0.0',
  orientation: 'portrait',
  description: 'Helping hands, organized.',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: true,
    googleServicesFile: googleServicesIos,
  },
  android: {
    package: bundleId,
    googleServicesFile: googleServicesAndroid,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/adaptive-icon.png',
    },
  },
  plugins: [
    'expo-router',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-google-signin/google-signin',
    './plugins/withRNFirebaseDisableSPM',
    [
      'expo-splash-screen',
      { backgroundColor: '#FFFFFF', image: './assets/images/splash-icon.png', imageWidth: 180 },
    ],
    ['expo-localization', { supportedLocales: ['ar', 'en'] }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'يستخدم Be My Hand موقعك الحالي فقط عند إضافة موقع لمستفيد. / Be My Hand uses your location only when you add a beneficiary pin.',
      },
    ],
    'expo-sharing',
    'expo-document-picker',
    [
      'expo-build-properties',
      {
        android: { enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true },
      },
    ],
    'expo-font',
    'expo-asset',
    'expo-image',
    [
      'expo-image-picker',
      {
        photosPermission:
          'يستخدم Be My Hand الصور التي تختارها فقط لرفع صور البانرات والمحتوى. / Be My Hand uses the photos you pick only to upload banner and content images.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: true,
  },
  extra: {
    appEnv: env.APP_ENV ?? 'development',
  },
});
