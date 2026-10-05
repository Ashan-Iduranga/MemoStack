import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/// Firebase project `memostack-5f574`, "MemoStack Web" app registration.
/// The app uses the Firebase JS SDK, so it needs the Web app config.
const firebaseConfig = {
  apiKey: 'AIzaSyDgPicCdp3MR3B3GR5GmxCTs6fwH_SyCQk',
  appId: '1:700157531357:web:4063e3a0c91166e879b734',
  messagingSenderId: '700157531357',
  projectId: 'memostack-5f574',
  storageBucket: 'memostack-5f574.firebasestorage.app',
  authDomain: 'memostack-5f574.firebaseapp.com',
};

const isFirstInit = getApps().length === 0;
export const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

/// AsyncStorage persistence keeps students signed in across app restarts.
/// `initializeAuth` may only run once per app, so fast refresh reuses it.
export const auth: Auth = isFirstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = getFirestore(app);
