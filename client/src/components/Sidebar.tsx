import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface SidebarItem<K extends string> {
  key: K;
  label: string;
  icon: string;
}

interface Props<K extends string> {
  items: SidebarItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
  onChangePassword?: () => void;
}

export function Sidebar<K extends string>({
  items,
  active,
  onSelect,
  userName,
  userRole,
  onLogout,
  onChangePassword,
}: Props<K>) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>nodePOS</Text>
      <View style={styles.items}>
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.key)}
              style={[styles.item, isActive && styles.itemActive]}>
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <Text style={styles.user} numberOfLines={1}>
          {userName}
        </Text>
        <Text style={styles.role}>{userRole}</Text>
        {onChangePassword ? (
          <Pressable onPress={onChangePassword} style={styles.logout}>
            <Text style={styles.changePasswordText}>Cambiar contraseña</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onLogout} style={styles.logout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    backgroundColor: colors.sidebar,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  brand: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  items: { flex: 1, gap: spacing.sm },
  item: { alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md },
  itemActive: { backgroundColor: 'rgba(249,115,22,0.18)' },
  icon: { fontSize: 26, marginBottom: 4 },
  label: { color: colors.sidebarText, fontSize: 13, fontWeight: '600' },
  labelActive: { color: colors.primary },
  footer: { borderTopWidth: 1, borderTopColor: '#44403C', paddingTop: spacing.md },
  user: { color: '#fff', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  role: { color: colors.sidebarText, fontSize: 11, textAlign: 'center', marginBottom: spacing.sm },
  logout: { paddingVertical: spacing.sm, alignItems: 'center' },
  logoutText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },
  changePasswordText: { color: colors.sidebarText, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
