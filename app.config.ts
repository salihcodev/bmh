import type { ConfigContext, ExpoConfig } from 'expo/config';

const env = process.env;

const isProd = env.APP_ENV === 'production';
const name = env.APP_NAME ?? (isProd ? 'Be My Hand' : 'Be My Hand (Dev)');
const slug = env.APP_SLUG ?? 'be-my-hand';
const scheme = env.APP_SCHEME ?? 'bemyhand';
const bundleId =
  env.APP_BUNDLE_ID ??
  (isProd ? 'com.salihcodev.bemyhand' : 'com.salihcodev.bemyhand.dev');
const googleServicesDir = isProd ? './firebase/prod' : './firebase/dev';
const googleServicesAndroid =
  env.GOOGLE_SERVICES_JSON ?? `${googleServicesDir}/google-services.json`;
const googleServicesIos =
  env.GOOGLE_SERVICES_PLIST ?? `${googleServicesDir}/GoogleService-Info.plist`;
// Join links (src/domain/invite.ts). Same default as src/config/env.ts; the site must serve
// apple-app-site-association and assetlinks.json for this host (WEB-05).
const linkDomain = env.EXPO_PUBLIC_LINK_DOMAIN || 'bmyhand.vercel.app';

// Brand colors (src/theme/tokens.ts). Native config can't import the app theme.
const LIME = '#C9F158';
const DARK_BACKGROUND = '#121212';

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
    associatedDomains: [`applinks:${linkDomain}`],
    icon: {
      light: './assets/images/icon.png',
      dark: './assets/images/icon-dark.png',
      tinted: './assets/images/icon-tinted.png',
    },
  },
  android: {
    package: bundleId,
    googleServicesFile: googleServicesAndroid,
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: linkDomain, pathPrefix: '/join' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: linkDomain, pathPrefix: '/bag' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    adaptiveIcon: {
      backgroundColor: LIME,
      foregroundImage: './assets/images/adaptive-icon.png',
      monochromeImage: './assets/images/adaptive-icon-monochrome.png',
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
      {
        backgroundColor: LIME,
        image: './assets/images/splash-blank.png',
        imageWidth: 160,
        dark: {
          backgroundColor: DARK_BACKGROUND,
          image: './assets/images/splash-blank.png',
        },
      },
    ],
    ['expo-localization', { supportedLocales: ['ar', 'en'] }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'يستخدم Be My Hand موقعك الحالي لإظهارك على الخريطة وحساب المسار، وعند إضافة موقع لمستفيد. / Be My Hand uses your location to show you on the map, calculate a driving route, and when you add a beneficiary pin.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    '@maplibre/maplibre-react-native',
    'expo-sharing',
    'expo-document-picker',
    [
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          enableBundleCompression: true,
          useLegacyPackaging: true,
          // One ABI. A universal APK ships four copies of every native library.
          buildArchs: ['arm64-v8a'],
        },
      },
    ],
    'expo-font',
    'expo-asset',
    'expo-image',
    [
      'expo-image-picker',
      {
        photosPermission:
          'يستخدم Be My Hand الصور التي تختارها فقط لرفع صورتك الشخصية وصور المحتوى. / Be My Hand uses the photos you pick only to upload your profile photo and content images.',
        cameraPermission:
          'يستخدم Be My Hand الكاميرا لالتقاط صورتك الشخصية فقط. / Be My Hand uses the camera only to take your profile photo.',
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
