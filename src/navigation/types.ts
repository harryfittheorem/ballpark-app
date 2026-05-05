import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ConfirmEmail: { email: string; password: string };
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MeStackParamList = {
  MeHome: undefined;
  EditKid: { kidId: string };
  AddKid: undefined;
};

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

export type MeStackScreenProps<T extends keyof MeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<MeStackParamList, T>,
  MainTabScreenProps<'Me'>
>;
