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

/**
 * v0.7 task #119: bottom nav grew from 5 to 7 tabs.
 *   Home · Videos · Work · Train · Rewards · Ranks · Me
 *
 * Book moved out of the bottom nav into:
 *   - a Quick Action on Home  (navigates Me → Book)
 *   - the Me sub-screen        (MeStack 'Book' route)
 *
 * Earn split into two top-level tabs (Rewards + Ranks). The old Store and
 * Earn-rules sub-tabs are merged inside the Rewards tab as in-screen
 * sub-tabs (see RewardsTabNavigator's local SubTabBar) so we don't lose
 * surface area, but the headline Earn surface is split per spec.
 */
export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Videos: NavigatorScreenParams<VideosStackParamList>;
  Work: NavigatorScreenParams<WorkStackParamList>;
  Train: undefined;
  Rewards: NavigatorScreenParams<RewardsStackParamList>;
  Ranks: undefined;
  Me: NavigatorScreenParams<MeStackParamList> | undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  VideoPlayback: { messageId: string };
  AddKid: undefined;
  // Onboarding gate shown immediately after a successful AddKid; renders
  // the Connect HitTrax CTA + an explicit "Skip for now" button so a
  // parent without a HitTrax membership is never blocked.
  ConnectHitTraxOnboarding: { kidId: string } | undefined;
};

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, T>,
  BottomTabScreenProps<MainTabParamList>
>;

/**
 * Videos tab stack — list root + session detail + swing detail.
 * SwingDetail / SessionDetail are pushed within the Videos tab so the
 * back affordance stays inside the tab. The full-screen VideoPlayback
 * modal continues to live on the Home stack (it's the destination for
 * coach messages, which originate from Home + Videos → Coach sub-tab).
 */
export type VideosStackParamList = {
  VideosHome: undefined;
  SessionDetail: { sessionId: string };
  SwingDetail: { swingId: string };
};

export type VideosStackScreenProps<T extends keyof VideosStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<VideosStackParamList, T>,
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

/**
 * v0.7 task #119: Book moved from the bottom nav to a Me sub-screen.
 * Parents reach it via Home → Quick Action ("Book Session") or via the
 * Me tab. The MeStack now hosts every "manage my account" surface
 * (Bookings, Orders, HitTrax, Book).
 */
export type MeStackParamList = {
  MeHome: undefined;
  Book: undefined;
  BookingsList: undefined;
  BookingDetail: { bookingId: string };
  Orders: undefined;
  ConnectHitTrax: undefined;
};

export type MeStackScreenProps<T extends keyof MeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<MeStackParamList, T>,
  BottomTabScreenProps<MainTabParamList>
>;

/**
 * Rewards tab stack. The Earn screen previously bundled Rewards + Store +
 * Ranks + Earn-rules behind a SubTabBar; with the v0.7 split, Ranks moves
 * out to its own bottom tab and Rewards/Store/Earn-rules collapse onto a
 * single screen with an in-screen sub-tab switcher. The stack only needs
 * the redeem modal in addition to the Rewards root.
 */
export type RewardsStackParamList = {
  RewardsHome: undefined;
  RewardRedeem: { productId: string; kidId: string };
};

export type RewardsStackScreenProps<T extends keyof RewardsStackParamList> =
  NativeStackScreenProps<RewardsStackParamList, T>;
