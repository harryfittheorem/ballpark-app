import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type SignUpFormData = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  LocationPicker: {
    signUpData: SignUpFormData;
  };
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Work: NavigatorScreenParams<WorkStackParamList>;
  Book: undefined;
  Earn: NavigatorScreenParams<EarnStackParamList>;
  Me: NavigatorScreenParams<MeStackParamList> | undefined;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

export type HomeStackParamList = {
  HomeMain: undefined;
  VideoPlayback: { messageId: string };
  AddKid: undefined;
  ConnectHitTraxOnboarding: { kidId: string } | undefined;
};

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, T>,
  BottomTabScreenProps<MainTabParamList>
>;

/**
 * Work tab — the consolidated work surface. Sub-tab routing for
 * Swings / Assign / Messages / HW / Drills happens *in-screen* on
 * `WorkHome`; the stack only registers the push destinations that the
 * sub-tabs navigate into (assignment detail, swing detail, message
 * thread, full-screen training player, etc.).
 */
export type WorkStackParamList = {
  WorkHome: { initialSubTab?: 'swings' | 'assign' | 'messages' | 'hw' | 'drills' } | undefined;
  AssignmentDetail: { assignmentId: string };
  SessionDetail: { sessionId: string };
  SwingDetail: { swingId: string };
  ShareCard: { swingId: string };
  SendVideoToCoach: { coachUserId?: string } | undefined;
  SendVideoSuccess: { coachUserId: string; kidId: string };
  MessagesInbox: undefined;
  MessageThread: { kidId: string; coachUserId: string };
  TrainingVideoPlayer: { videoId: string };
};

export type WorkStackScreenProps<T extends keyof WorkStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<WorkStackParamList, T>,
  BottomTabScreenProps<MainTabParamList>
>;

/**
 * Earn tab — re-merges Rewards / Store / Ranks / Earn-rules into one
 * screen with an in-screen pill switcher. Only push destination is the
 * reward-redeem confirmation modal.
 */
export type EarnStackParamList = {
  EarnHome: { initialSubTab?: 'rewards' | 'store' | 'ranks' | 'rules' } | undefined;
  RewardRedeem: { productId: string; kidId: string };
  StoreCheckout: { productId: string; kidId: string };
};

export type EarnStackScreenProps<T extends keyof EarnStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<EarnStackParamList, T>,
  BottomTabScreenProps<MainTabParamList>
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

/**
 * Me tab — Profile root + account-management sub-screens. Book is no
 * longer here; it's a top-level tab.
 */
export type MeStackParamList = {
  MeHome: undefined;
  BookingsList: undefined;
  BookingDetail: { bookingId: string };
  Orders: undefined;
  ConnectHitTrax: undefined;
  PaymentMethod: undefined;
};

export type MeStackScreenProps<T extends keyof MeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<MeStackParamList, T>,
  BottomTabScreenProps<MainTabParamList>
>;
