import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True inside the Expo Go app, which cannot load custom native modules (camera AI). */
export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
