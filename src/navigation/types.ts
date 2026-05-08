import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type WorkStackParamList = {
  WorkHome: undefined;
  AssignmentDetail: { assignmentId: string };
};

export type WorkStackScreenProps<T extends keyof WorkStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<WorkStackParamList, T>,
  BottomTabScreenProps<MainTabParamList>
>;

export type MainTabParamList = {
  Home: undefined;
  Work: NavigatorScreenParams<WorkStackParamList>;
  Book: undefined;
  Earn: undefined;
  Me: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  VideoPlayback: { messageId: string };
  AddKid: undefined;
};

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, T>,
  BottomTabScreenProps<MainTabParamList>
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

export type CoachInboxStackParamList = {
  InboxHome: undefined;
  RecordVideo: { purpose?: 'coach_message' | 'drill_assignment' } | undefined;
  RecipientPicker: { videoId: string };
  SendConfirmation: {
    videoId: string;
    recipientFamilyId: string;
    recipientKidId: string;
  };
  SentVideos: undefined;
  CreateAssignment: { drillVideoId?: string } | undefined;
  ReviewQueue: undefined;
  ReviewAssignment: { assignmentId: string };
  CoachVideoPlayback: { playbackId: string };
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
  Orders: undefined;
};

export type MeStackScreenProps<T extends keyof MeStackParamList> = NativeStackScreenProps<
  MeStackParamList,
  T
>;

export type EarnStackParamList = {
  EarnHome: undefined;
  RewardRedeem: { productId: string; kidId: string };
};

export type EarnStackScreenProps<T extends keyof EarnStackParamList> = NativeStackScreenProps<
  EarnStackParamList,
  T
>;
