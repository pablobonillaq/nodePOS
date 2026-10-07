import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';

/**
 * Pantalla obligatoria cuando el usuario inició sesión con una contraseña temporal
 * (usuario nuevo o contraseña restablecida por el administrador). Hasta que la cambie,
 * el servidor rechaza cualquier otra operación.
 */
export function ChangePasswordScreen() {
  const { user, logout } = useAuth();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Crea tu contraseña</Text>
          <Text style={styles.subtitle}>
            Hola {user?.name}. Iniciaste sesión con una contraseña temporal. Para proteger tu cuenta,
            elige una contraseña nueva que solo tú conozcas. Nadie más, ni el administrador, podrá
            verla.
          </Text>
          <ChangePasswordForm currentLabel="Contraseña temporal" />
          <Pressable onPress={logout} style={styles.logout}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sidebar },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: 460,
    maxWidth: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.xl, lineHeight: 21 },
  logout: { marginTop: spacing.lg, alignItems: 'center' },
  logoutText: { color: colors.textMuted, fontSize: 14 },
});
