import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import {
  ACTIVE_ORDERS,
  CANCEL_ORDER,
  ORDERS,
  PAY_ORDER,
  UPDATE_ORDER_STATUS,
} from '../api/queries';
import type { Order, OrderStatus, PaymentMethod } from '../api/types';
import { Button } from '../components/Button';
import { PaymentModal } from '../components/PaymentModal';
import { PromptModal } from '../components/PromptModal';
import { EmptyView, ErrorView, LoadingView } from '../components/ScreenState';
import { ORDERS_POLL_INTERVAL } from '../config';
import { useMutation, useQuery } from '../hooks/useGraphQL';
import { colors, radius, spacing } from '../theme';
import {
  minutesSince,
  money,
  paymentMethodLabel,
  paymentStatusLabel,
  statusLabel,
  time,
} from '../utils/format';

type Tab = 'active' | 'today';

const COLUMNS: { status: OrderStatus; title: string; color: string }[] = [
  { status: 'PENDING', title: 'Pendientes', color: colors.warning },
  { status: 'PREPARING', title: 'Preparando', color: colors.info },
  { status: 'READY', title: 'Listas', color: colors.success },
];

const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  PENDING: { status: 'PREPARING', label: 'Preparar' },
  PREPARING: { status: 'READY', label: 'Lista' },
  READY: { status: 'COMPLETED', label: 'Entregar' },
};

const statusColors: Record<OrderStatus, { bg: string; fg: string }> = {
  PENDING: { bg: colors.warningSoft, fg: colors.warning },
  PREPARING: { bg: colors.infoSoft, fg: colors.info },
  READY: { bg: colors.successSoft, fg: colors.success },
  COMPLETED: { bg: colors.bg, fg: colors.textMuted },
  CANCELLED: { bg: colors.dangerSoft, fg: colors.danger },
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function OrdersScreen() {
  const [tab, setTab] = useState<Tab>('active');
  const [fromToday] = useState(startOfToday);

  const active = useQuery<{ activeOrders: Order[] }>(ACTIVE_ORDERS, undefined, {
    pollInterval: ORDERS_POLL_INTERVAL,
    skip: tab !== 'active',
  });
  const today = useQuery<{ orders: { nodes: Order[]; totalCount: number } }>(
    ORDERS,
    { filter: { from: fromToday }, limit: 200 },
    { skip: tab !== 'today' },
  );

  const [updateStatus] = useMutation(UPDATE_ORDER_STATUS);
  const [cancelOrder, cancelState] = useMutation(CANCEL_ORDER);
  const [payOrder, payState] = useMutation(PAY_ORDER);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  const refresh = () => (tab === 'active' ? active.refetch(true) : today.refetch(true));

  const advance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setBusyId(order.id);
    try {
      await updateStatus({ orderId: order.id, status: next.status });
      await refresh();
    } catch (err) {
      Alert.alert('No se pudo actualizar', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const pay = async (method: PaymentMethod, amountPaid?: number) => {
    if (!payingOrder) return;
    try {
      const { payOrder: paid } = (await payOrder({
        orderId: payingOrder.id,
        method,
        amountPaid,
      })) as { payOrder: Order };
      setPayingOrder(null);
      if (paid.change) Alert.alert(`Ticket #${paid.ticketNumber}`, `Cambio: ${money(paid.change)}`);
      await refresh();
    } catch (err) {
      Alert.alert('No se pudo cobrar', errorMessage(err));
    }
  };

  const cancel = async (reason: string) => {
    if (!cancellingOrder) return;
    try {
      await cancelOrder({ orderId: cancellingOrder.id, reason });
      setCancellingOrder(null);
      await refresh();
    } catch (err) {
      Alert.alert('No se pudo cancelar', errorMessage(err));
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = { PENDING: [], PREPARING: [], READY: [] };
    for (const o of active.data?.activeOrders ?? []) map[o.status]?.push(o);
    return map;
  }, [active.data]);

  const renderCard = (order: Order) => {
    const next = NEXT_STATUS[order.status];
    const unpaid = order.paymentStatus === 'UNPAID';
    const blockedDelivery = next?.status === 'COMPLETED' && unpaid;
    const mins = minutesSince(order.createdAt);
    return (
      <View key={order.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.ticket}>#{order.ticketNumber}</Text>
          <Text style={[styles.elapsed, mins >= 15 && { color: colors.danger }]}>
            {time(order.createdAt)} · {mins} min
          </Text>
        </View>
        {order.customerName ? <Text style={styles.customer}>{order.customerName}</Text> : null}
        {order.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <Text style={styles.itemText}>
              <Text style={styles.itemQty}>{item.quantity}× </Text>
              {item.productName}
            </Text>
            {item.notes ? <Text style={styles.itemNotes}>↳ {item.notes}</Text> : null}
          </View>
        ))}
        {order.notes ? <Text style={styles.itemNotes}>Nota: {order.notes}</Text> : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardTotal}>{money(order.total)}</Text>
          <Text style={[styles.badge, unpaid ? styles.badgeUnpaid : styles.badgePaid]}>
            {unpaid ? 'Sin pagar' : paymentMethodLabel[order.paymentMethod ?? 'CASH']}
          </Text>
        </View>
        <View style={styles.actions}>
          {next ? (
            <Button
              title={blockedDelivery ? 'Cobrar primero' : next.label}
              size="sm"
              style={styles.flex}
              disabled={blockedDelivery}
              loading={busyId === order.id}
              onPress={() => advance(order)}
            />
          ) : null}
          {unpaid ? (
            <Button
              title="Cobrar"
              size="sm"
              variant="success"
              style={styles.flex}
              onPress={() => setPayingOrder(order)}
            />
          ) : null}
          <Button title="✕" size="sm" variant="secondary" onPress={() => setCancellingOrder(order)} />
        </View>
      </View>
    );
  };

  const current = tab === 'active' ? active : today;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Órdenes</Text>
        <View style={styles.tabs}>
          {(['active', 'today'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'active' ? 'En curso' : 'Hoy'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button title="Actualizar" variant="secondary" size="sm" onPress={() => current.refetch()} />
      </View>

      {current.loading && !current.data ? (
        <LoadingView />
      ) : current.error && !current.data ? (
        <ErrorView message={current.error} onRetry={() => current.refetch()} />
      ) : tab === 'active' ? (
        <View style={styles.board}>
          {COLUMNS.map((col) => (
            <View key={col.status} style={styles.column}>
              <View style={[styles.columnHeader, { borderBottomColor: col.color }]}>
                <Text style={styles.columnTitle}>{col.title}</Text>
                <Text style={[styles.columnCount, { backgroundColor: col.color }]}>
                  {grouped[col.status].length}
                </Text>
              </View>
              <ScrollView contentContainerStyle={styles.columnBody}>
                {grouped[col.status].length ? (
                  grouped[col.status].map(renderCard)
                ) : (
                  <Text style={styles.emptyColumn}>Sin órdenes</Text>
                )}
              </ScrollView>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={today.data?.orders.nodes ?? []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={today.loading} onRefresh={() => today.refetch()} />
          }
          ListEmptyComponent={<EmptyView message="Aún no hay órdenes hoy" />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowTicket}>#{item.ticketNumber}</Text>
              <Text style={styles.rowTime}>{time(item.createdAt)}</Text>
              <Text style={styles.rowCustomer} numberOfLines={1}>
                {item.customerName ?? '—'} · {item.items.reduce((s, i) => s + i.quantity, 0)} art.
              </Text>
              <Text
                style={[
                  styles.status,
                  { backgroundColor: statusColors[item.status].bg, color: statusColors[item.status].fg },
                ]}>
                {statusLabel[item.status]}
              </Text>
              <Text style={styles.rowPayment}>
                {item.paymentStatus === 'PAID' && item.paymentMethod
                  ? paymentMethodLabel[item.paymentMethod]
                  : paymentStatusLabel[item.paymentStatus]}
              </Text>
              <Text style={styles.rowTotal}>{money(item.total)}</Text>
            </View>
          )}
        />
      )}

      <PaymentModal
        visible={!!payingOrder}
        title={payingOrder ? `Cobrar ticket #${payingOrder.ticketNumber}` : 'Cobrar'}
        total={payingOrder?.total ?? 0}
        loading={payState.loading}
        onClose={() => setPayingOrder(null)}
        onConfirm={pay}
      />

      <PromptModal
        visible={!!cancellingOrder}
        title={cancellingOrder ? `Cancelar ticket #${cancellingOrder.ticketNumber}` : 'Cancelar'}
        label="Motivo de la cancelación"
        placeholder="Ej. el cliente se retiró"
        confirmText="Cancelar orden"
        confirmVariant="danger"
        required
        loading={cancelState.loading}
        onClose={() => setCancellingOrder(null)}
        onSubmit={cancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  tabs: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3, flex: 1, maxWidth: 300 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.text },

  board: { flex: 1, flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, backgroundColor: '#EEECEA', borderRadius: radius.lg, overflow: 'hidden' },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 3,
  },
  columnTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  columnCount: {
    color: '#fff',
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  columnBody: { padding: spacing.sm, gap: spacing.sm },
  emptyColumn: { textAlign: 'center', color: colors.textMuted, padding: spacing.xl },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticket: { fontSize: 22, fontWeight: '800', color: colors.text },
  elapsed: { fontSize: 13, color: colors.textMuted },
  customer: { fontSize: 14, fontWeight: '600', color: colors.primaryDark, marginBottom: 4 },
  item: { marginTop: 4 },
  itemText: { fontSize: 15, color: colors.text },
  itemQty: { fontWeight: '800' },
  itemNotes: { fontSize: 13, color: colors.warning, marginLeft: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cardTotal: { fontSize: 17, fontWeight: '700', color: colors.text },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  badgeUnpaid: { backgroundColor: colors.dangerSoft, color: colors.danger },
  badgePaid: { backgroundColor: colors.successSoft, color: colors.success },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },

  list: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  rowTicket: { width: 60, fontSize: 17, fontWeight: '800', color: colors.text },
  rowTime: { width: 50, color: colors.textMuted },
  rowCustomer: { flex: 1, color: colors.text },
  status: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  rowPayment: { width: 110, color: colors.textMuted, textAlign: 'center' },
  rowTotal: { width: 90, textAlign: 'right', fontWeight: '700', color: colors.text },
});
