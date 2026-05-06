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

export type HomeStackParamList = {
  HomeMain: undefined;
  VideoPlayback: { messageId: string };
  AddKid: undefined;
};

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = NativeStackScreenProps<
  HomeStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

export type CoachInboxStackParamList = {
  InboxHome: undefined;
  RecordVideo: undefined;
  RecipientPicker: { videoId: string };
  SendConfirmation: {
    videoId: string;
    recipientFamilyId: string;
    recipientKidId: string;
  };
  SentVideos: undefined;
};

export type CoachInboxStackScreenProps<T extends keyof CoachInboxStackParamList> =
  NativeStackScreenProps<CoachInboxStackParamList, T>;

export type CoachTabParamList = {
  Inbox: undefined;
};

export type CoachTabScreenProps<T extends keyof CoachTabParamList> = BottomTabScreenProps<
  CoachTabParamList,
  T
>;

export type MeStackParamList = {
  MeHome: undefined;
  BookingsList: undefined;
  BookingDetail: { bookingId: string };
};

export type MeStackScreenProps<T extends keyof MeStackParamList> = NativeStackScreenProps<
  MeStackParamList,
  T
>;
