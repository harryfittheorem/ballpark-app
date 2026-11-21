import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';

export type CoachActionCardProps = {
  title: string;
  subtitle: string;
  icon: ComponentType<LucideProps>;
  onPress: () => void;
  disabled?: boolean;
};

export type CoachGreetingHeaderProps = {
  firstName: string | null;
  appRole: string | null;
};
