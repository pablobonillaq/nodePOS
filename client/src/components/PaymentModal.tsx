import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PaymentMethod } from '../api/types';
import { colors, radius, spacing } from '../theme';
import { money, parseAmount, paymentMethodLabel } from '../utils/format';
import { AppModal } from './AppModal';
import { Button } from './Button';
import { TextField } from './TextField';

interface Props {
  visible: boolean;
  total: number;
  title?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, amountPaid?: number) => void;
}

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER'];
const BILLS = [20, 50, 100, 200, 500, 1000];

export function PaymentModal({ visible, total, title = 'Cobrar', loading, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [received, setReceived] = useState('');

  useEffect(() => {
    if (visible) {
      setMethod('CASH');
      setReceived('');
    }
  }, [visible]);

  // Sugerencias: monto exacto + billetes que cubren el total
  const quickAmounts = useMemo(() => {
    const options = BILLS.filter((b) => b > total).slice(0, 3);
    return [total, ...options];
  }, [total]);

  const amount = parseAmount(received);
  const change = Number.isFinite(amount) ? amount - total : NaN;
  const cashOk = Number.isFinite(amount) && amount >= total;
  const canConfirm = method !== 'CASH' || cashOk;

  return (
    <AppModal
      visible={visible}
      title={title}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button title="Cancelar" variant="secondary" onPress={onClose} />
          <Button
            title={`Confirmar ${money(total)}`}
            variant="success"
            size="lg"
            loading={loading}
            disabled={!canConfirm}
            onPress={() => onConfirm(method, method === 'CASH' ? amount : undefined)}
          />
        </>
      }>
      <Text style={styles.totalLabel}>Total a cobrar</Text>
      <Text style={styles.total}>{money(total)}</Text>

      <View style={styles.methods}>
        {METHODS.map((m) => (
          <Pressable
            key={m}
            onPress={() => setMethod(m)}
            style={[styles.method, method === m && styles.methodActive]}>
            <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
              {paymentMethodLabel[m]}
            </Text>
          </Pressable>
        ))}
      </View>

      {method === 'CASH' ? (
        <>
          <TextField
            label="Recibido"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={received}
            onChangeText={setReceived}
          />
          <View style={styles.quick}>
            {quickAmounts.map((a, i) => (
              <Button
                key={`${a}-${i}`}
                title={i === 0 ? 'Exacto' : money(a)}
                variant="secondary"
                onPress={() => setReceived(a.toFixed(2))}
                style={styles.quickBtn}
              />
            ))}
          </View>
          <View style={[styles.changeBox, { backgroundColor: cashOk ? colors.successSoft : colors.bg }]}>
            <Text style={styles.changeLabel}>Cambio</Text>
            <Text style={[styles.change, { color: cashOk ? colors.success : colors.textMuted }]}>
              {Number.isFinite(change) && change >= 0 ? money(change) : '—'}
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.hint}>
          Se registrará el pago por {money(total)} con {paymentMethodLabel[method].toLowerCase()}.
        </Text>
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  totalLabel: { color: colors.textMuted, fontSize: 14 },
  total: { fontSize: 40, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  methods: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  method: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  methodActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  methodText: { fontSize: 16, fontWeight: '600', color: colors.text },
  methodTextActive: { color: colors.primaryDark },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  quickBtn: { minWidth: 90 },
  changeBox: { borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  changeLabel: { color: colors.textMuted, fontSize: 14 },
  change: { fontSize: 32, fontWeight: '800' },
  hint: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.md },
});
