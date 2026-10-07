import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  label: string;
  selected?: boolean;
  color?: string | null;
  onPress?: () => void;
}

export function Chip({ label, selected, color, onPress }: Props) {
  const accent = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: accent, borderColor: accent }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <Text style={[styles.text, { color: selected ? '#fff' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginRight: 8,
  },
  text: { fontSize: 15, fontWeight: '600' },
});
