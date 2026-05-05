import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabParamList = {
  Home: undefined;
  Work: undefined;
  Book: undefined;
  Earn: undefined;
  Me: undefined;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

export type MeStackParamList = {
  MeHome: undefined;
  BookingsList: undefined;
};

export type MeStackScreenProps<T extends keyof MeStackParamList> = NativeStackScreenProps<
  MeStackParamList,
  T
>;
