import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

/// `firebase/auth` only declares this in its React Native typings, which
/// TypeScript can't reach through the package's `exports` map (`types` is
/// listed before the `react-native` condition). Metro resolves the real
/// function at runtime. Signature copied from @firebase/auth's RN build.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
