import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import { Button } from './Button';
import { TextField } from './TextField';

/** Mismas reglas que valida el servidor. */
const RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'Al menos 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Al menos una letra', test: (p) => /[A-Za-z]/.test(p) },
  { label: 'Al menos un número', test: (p) => /[0-9]/.test(p) },
];

interface Props {
  /** Texto del campo de contraseña actual (ej. "Contraseña temporal") */
  currentLabel?: string;
  onDone?: () => void;
  onCancel?: () => void;
}

export function ChangePasswordForm({ currentLabel = 'Contraseña actual', onDone, onCancel }: Props) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rulesOk = RULES.every((r) => r.test(next));
  const matches = next.length > 0 && next === confirm;
  const differs = next !== current;
  const canSubmit = current.length > 0 && rulesOk && matches && differs;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await changePassword(current, next);
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextField
        label={currentLabel}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label="Nueva contraseña"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label="Confirmar nueva contraseña"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={submit}
      />

      <View style={styles.rules}>
        {RULES.map((r) => (
          <Rule key={r.label} ok={r.test(next)} label={r.label} />
        ))}
        <Rule ok={matches} label="Las contraseñas coinciden" />
        {current.length > 0 && next.length > 0 ? (
          <Rule ok={differs} label="Es diferente a la actual" />
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {onCancel ? <Button title="Cancelar" variant="secondary" onPress={onCancel} /> : null}
        <Button
          title="Cambiar contraseña"
          size="lg"
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
          style={styles.submit}
        />
      </View>
    </View>
  );
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Text style={[styles.rule, { color: ok ? colors.success : colors.textMuted }]}>
      {ok ? '✓' : '○'} {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  rules: { marginBottom: spacing.md, gap: 2 },
  rule: { fontSize: 13 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  submit: { flex: 1 },
});
