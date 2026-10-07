import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';

export function LoginScreen() {
  const { login, serverUrl } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(serverUrl);
  const [showServer, setShowServer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setServer(serverUrl), [serverUrl]);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password, server);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.brand}>nodePOS</Text>
        <Text style={styles.subtitle}>Inicia sesión para comenzar a vender</Text>

        <TextField
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <TextField
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        {showServer ? (
          <TextField
            label="Servidor"
            value={server}
            onChangeText={setServer}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.50:4000"
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Entrar"
          size="lg"
          onPress={submit}
          loading={loading}
          disabled={!username.trim() || !password}
        />

        <Pressable onPress={() => setShowServer((s) => !s)} style={styles.serverToggle}>
          <Text style={styles.serverText}>
            {showServer ? 'Ocultar servidor' : `Servidor: ${server}`}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sidebar,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: 420,
    maxWidth: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  brand: { fontSize: 32, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  serverToggle: { marginTop: spacing.lg, alignItems: 'center' },
  serverText: { color: colors.textMuted, fontSize: 13 },
});
