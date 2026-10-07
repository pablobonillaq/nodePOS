import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

interface Props {
  title: string;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const variantStyles: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  danger: { bg: colors.danger, fg: '#fff', border: colors.danger },
  success: { bg: colors.success, fg: '#fff', border: colors.success },
  ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
};

const sizeStyles = {
  sm: { paddingVertical: 6, paddingHorizontal: 10, fontSize: 13 },
  md: { paddingVertical: 10, paddingHorizontal: 16, fontSize: 15 },
  lg: { paddingVertical: 16, paddingHorizontal: 20, fontSize: 18 },
};

export function Button({
  title,
  onPress,
  onLongPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
}: Props) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.text, { color: v.fg, fontSize: s.fontSize }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: { fontWeight: '600' },
});
