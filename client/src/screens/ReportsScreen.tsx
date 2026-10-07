import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { REPORTS } from '../api/queries';
import type { PaymentMethod } from '../api/types';
import { Chip } from '../components/Chip';
import { ErrorView, LoadingView } from '../components/ScreenState';
import { useQuery } from '../hooks/useGraphQL';
import { colors, radius, spacing } from '../theme';
import { money, paymentMethodLabel } from '../utils/format';

interface ReportsData {
  salesSummary: {
    orderCount: number;
    itemsSold: number;
    grossSales: number;
    tax: number;
    netSales: number;
    averageTicket: number;
    cancelledCount: number;
    byPaymentMethod: { method: PaymentMethod; orderCount: number; total: number }[];
  };
  topProducts: { productId: string; productName: string; quantity: number; revenue: number }[];
  salesByHour: { hour: number; orderCount: number; total: number }[];
  salesByDay: { date: string; orderCount: number; total: number }[];
}

type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'thisMonth';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'week', label: 'Últimos 7 días' },
  { key: 'month', label: 'Últimos 30 días' },
  { key: 'thisMonth', label: 'Este mes' },
];

/** Rango [from, to) en hora local de la tablet. */
function computeRange(key: RangeKey): { from: string; to: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  switch (key) {
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case 'week':
      start.setDate(start.getDate() - 6);
      break;
    case 'month':
      start.setDate(start.getDate() - 29);
      break;
    case 'thisMonth':
      start.setDate(1);
      break;
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

export function ReportsScreen() {
  const [range, setRange] = useState<RangeKey>('today');
  const variables = useMemo(() => computeRange(range), [range]);
  const { data, loading, error, refetch } = useQuery<ReportsData>(REPORTS, variables);
  const multiDay = range !== 'today' && range !== 'yesterday';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={() => refetch()} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Reportes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {RANGES.map((r) => (
            <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />
          ))}
        </ScrollView>
      </View>

      {loading && !data ? (
        <View style={styles.placeholder}>
          <LoadingView />
        </View>
      ) : error && !data ? (
        <View style={styles.placeholder}>
          <ErrorView message={error} onRetry={() => refetch()} />
        </View>
      ) : data ? (
        <ReportBody data={data} multiDay={multiDay} />
      ) : null}
    </ScrollView>
  );
}

function ReportBody({ data, multiDay }: { data: ReportsData; multiDay: boolean }) {
  const s = data.salesSummary;
  const maxTop = Math.max(1, ...data.topProducts.map((p) => p.quantity));

  return (
    <>
      <View style={styles.stats}>
        <Stat label="Ventas" value={money(s.grossSales)} highlight />
        <Stat label="Órdenes" value={String(s.orderCount)} />
        <Stat label="Ticket promedio" value={money(s.averageTicket)} />
        <Stat label="Artículos vendidos" value={String(s.itemsSold)} />
        <Stat label="Ventas sin IVA" value={money(s.netSales)} />
        <Stat label="IVA" value={money(s.tax)} />
        <Stat label="Canceladas" value={String(s.cancelledCount)} warn={s.cancelledCount > 0} />
      </View>

      <View style={styles.row}>
        <Card title="Por forma de pago" style={styles.flex1}>
          {s.byPaymentMethod.length === 0 ? (
            <Text style={styles.empty}>Sin ventas en el periodo</Text>
          ) : (
            s.byPaymentMethod.map((m) => (
              <BarRow
                key={m.method}
                label={`${paymentMethodLabel[m.method]} (${m.orderCount})`}
                value={money(m.total)}
                ratio={s.grossSales ? m.total / s.grossSales : 0}
                color={colors.info}
              />
            ))
          )}
        </Card>

        <Card title="Productos más vendidos" style={styles.flex2}>
          {data.topProducts.length === 0 ? (
            <Text style={styles.empty}>Sin ventas en el periodo</Text>
          ) : (
            data.topProducts.map((p, i) => (
              <BarRow
                key={p.productId}
                label={`${i + 1}. ${p.productName}`}
                value={`${p.quantity} · ${money(p.revenue)}`}
                ratio={p.quantity / maxTop}
                color={colors.primary}
              />
            ))
          )}
        </Card>
      </View>

      <Card title="Ventas por hora">
        <HourChart data={data.salesByHour} />
      </Card>

      {multiDay ? (
        <Card title="Ventas por día">
          {data.salesByDay.length === 0 ? (
            <Text style={styles.empty}>Sin ventas en el periodo</Text>
          ) : (
            data.salesByDay.map((d) => {
              const max = Math.max(1, ...data.salesByDay.map((x) => x.total));
              return (
                <BarRow
                  key={d.date}
                  label={`${d.date} (${d.orderCount})`}
                  value={money(d.total)}
                  ratio={d.total / max}
                  color={colors.success}
                />
              );
            })
          )}
        </Card>
      ) : null}
    </>
  );
}

function Stat({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <View style={[styles.stat, highlight && styles.statHighlight]}>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          highlight && styles.statValueHighlight,
          warn && { color: colors.danger },
        ]}>
        {value}
      </Text>
    </View>
  );
}

function Card({ title, children, style }: { title: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BarRow({ label, value, ratio, color }: { label: string; value: string; ratio: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, ratio * 100)}%` as `${number}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function HourChart({ data }: { data: ReportsData['salesByHour'] }) {
  if (data.length === 0) return <Text style={styles.empty}>Sin ventas en el periodo</Text>;
  const minHour = Math.min(...data.map((d) => d.hour));
  const maxHour = Math.max(...data.map((d) => d.hour));
  const byHour = new Map(data.map((d) => [d.hour, d]));
  const max = Math.max(1, ...data.map((d) => d.total));
  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  return (
    <View style={styles.chart}>
      {hours.map((h) => {
        const entry = byHour.get(h);
        const ratio = entry ? entry.total / max : 0;
        return (
          <View key={h} style={styles.chartCol}>
            <Text style={styles.chartValue}>{entry ? entry.orderCount : ''}</Text>
            <View style={styles.chartBarArea}>
              <View style={[styles.chartBar, { height: `${Math.max(ratio * 100, entry ? 3 : 0)}%` as `${number}%` }]} />
            </View>
            <Text style={styles.chartLabel}>{h}h</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  placeholder: { height: 400 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: {
    flexGrow: 1,
    minWidth: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  statHighlight: { backgroundColor: colors.primary },
  statLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  statLabelHighlight: { color: '#FFEDD5' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  statValueHighlight: { color: '#fff' },

  row: { flexDirection: 'row', gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  empty: { color: colors.textMuted, paddingVertical: spacing.md },

  barRow: { marginBottom: spacing.md },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { flex: 1, color: colors.text, fontSize: 14, marginRight: spacing.sm },
  barValue: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  barTrack: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },

  chart: { flexDirection: 'row', height: 200, alignItems: 'flex-end', gap: 4 },
  chartCol: { flex: 1, alignItems: 'center', height: '100%' },
  chartValue: { fontSize: 11, color: colors.textMuted, height: 16 },
  chartBarArea: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', backgroundColor: colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
