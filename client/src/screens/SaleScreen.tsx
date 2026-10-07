import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { errorMessage } from '../api/client';
import { CREATE_ORDER, MENU, PAY_ORDER, SET_AVAILABILITY } from '../api/queries';
import type { Category, Order, PaymentMethod, Product } from '../api/types';
import { AppModal } from '../components/AppModal';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { PaymentModal } from '../components/PaymentModal';
import { PromptModal } from '../components/PromptModal';
import { ErrorView, LoadingView } from '../components/ScreenState';
import { useMutation, useQuery } from '../hooks/useGraphQL';
import { colors, radius, spacing } from '../theme';
import { money } from '../utils/format';

interface CartLine {
  key: string;
  product: Product;
  quantity: number;
  notes: string;
}

interface MenuData {
  categories: Category[];
  products: Product[];
}

const SIDEBAR_WIDTH = 120;
const CART_WIDTH = 360;
const CARD_MIN_WIDTH = 160;

let lineCounter = 0;

export function SaleScreen() {
  const { width } = useWindowDimensions();
  const menu = useQuery<MenuData>(MENU);
  const [createOrder] = useMutation<{ createOrder: Order }>(CREATE_ORDER);
  const [payOrder] = useMutation<{ payOrder: Order }>(PAY_ORDER);
  const [setAvailability] = useMutation(SET_AVAILABILITY);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [noteLine, setNoteLine] = useState<CartLine | null>(null);
  const [paying, setPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Order | null>(null);

  const categories = menu.data?.categories ?? [];
  const colorByCategory = useMemo(
    () => new Map(categories.map((c) => [c.id, c.color ?? colors.primary])),
    [categories],
  );

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (menu.data?.products ?? []).filter(
      (p) =>
        (!categoryId || p.categoryId === categoryId) &&
        (!term || p.name.toLowerCase().includes(term)),
    );
  }, [menu.data, categoryId, search]);

  const gridWidth = width - SIDEBAR_WIDTH - CART_WIDTH - spacing.md * 2;
  const columns = Math.max(2, Math.floor(gridWidth / CARD_MIN_WIDTH));
  // Evita que la última fila se estire si tiene menos tarjetas
  const cardMaxWidth = gridWidth / columns - (spacing.xs + 2) * 2;
  const total = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  // ─── Carrito ───────────────────────────────────────────────────────────────
  const addProduct = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id && !l.notes);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { key: `l${++lineCounter}`, product, quantity: 1, notes: '' }];
    });
  };

  const changeQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const setNotes = (key: string, notes: string) => {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, notes } : l)));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
  };

  const markSoldOut = (product: Product) => {
    Alert.alert('Marcar como agotado', `¿"${product.name}" ya no está disponible?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Agotado',
        style: 'destructive',
        onPress: async () => {
          try {
            await setAvailability({ id: product.id, available: false });
            setCart((prev) => prev.filter((l) => l.product.id !== product.id));
            menu.refetch(true);
          } catch (err) {
            Alert.alert('Error', errorMessage(err));
          }
        },
      },
    ]);
  };

  // ─── Crear / cobrar orden ──────────────────────────────────────────────────
  const buildInput = () => ({
    customerName: customerName.trim() || undefined,
    items: cart.map((l) => ({
      productId: l.product.id,
      quantity: l.quantity,
      notes: l.notes || undefined,
    })),
  });

  const submitOrder = async (payment?: { method: PaymentMethod; amountPaid?: number }) => {
    setSubmitting(true);
    let created: Order | null = null;
    try {
      const order = (await createOrder({ input: buildInput() })).createOrder;
      created = order;
      let finalOrder = order;
      if (payment) {
        finalOrder = (
          await payOrder({
            orderId: order.id,
            method: payment.method,
            amountPaid: payment.amountPaid,
          })
        ).payOrder;
      }
      setPaying(false);
      clearCart();
      setResult(finalOrder);
    } catch (err) {
      if (created) {
        // La orden se creó pero el pago falló: se puede cobrar desde "Órdenes"
        setPaying(false);
        clearCart();
        Alert.alert(
          `Orden #${created.ticketNumber} creada`,
          `No se pudo registrar el pago: ${errorMessage(err)}\nCóbrala desde la pantalla de Órdenes.`,
        );
      } else {
        Alert.alert('No se pudo crear la orden', errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (menu.loading && !menu.data) return <LoadingView />;
  if (menu.error && !menu.data) return <ErrorView message={menu.error} onRetry={() => menu.refetch()} />;

  return (
    <View style={styles.container}>
      {/* Catálogo */}
      <View style={styles.catalog}>
        <View style={styles.toolbar}>
          <TextInput
            placeholder="Buscar producto…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.search}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Chip label="Todos" selected={!categoryId} onPress={() => setCategoryId(null)} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              color={c.color}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </ScrollView>

        <FlatList
          key={`cols-${columns}`}
          data={products}
          numColumns={columns}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={menu.loading} onRefresh={() => menu.refetch()} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No hay productos disponibles</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => addProduct(item)}
              onLongPress={() => markSoldOut(item)}
              style={({ pressed }) => [
                styles.product,
                { maxWidth: cardMaxWidth },
                { borderTopColor: colorByCategory.get(item.categoryId ?? '') ?? colors.border },
                pressed && { opacity: 0.7 },
              ]}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.productPrice}>{money(item.price)}</Text>
            </Pressable>
          )}
        />
        <Text style={styles.tip}>Mantén presionado un producto para marcarlo como agotado</Text>
      </View>

      {/* Carrito */}
      <View style={styles.cart}>
        <Text style={styles.cartTitle}>Orden actual</Text>
        <TextInput
          placeholder="Nombre del cliente (opcional)"
          placeholderTextColor={colors.textMuted}
          value={customerName}
          onChangeText={setCustomerName}
          style={styles.customer}
        />

        <FlatList
          data={cart}
          keyExtractor={(l) => l.key}
          style={styles.cartList}
          ListEmptyComponent={<Text style={styles.empty}>Toca un producto para agregarlo</Text>}
          renderItem={({ item }) => (
            <View style={styles.line}>
              <View style={styles.lineInfo}>
                <Text style={styles.lineName} numberOfLines={1}>
                  {item.product.name}
                </Text>
                <Pressable onPress={() => setNoteLine(item)}>
                  <Text style={item.notes ? styles.lineNotes : styles.addNote}>
                    {item.notes || '+ Agregar nota'}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.qty}>
                <Pressable style={styles.qtyBtn} onPress={() => changeQty(item.key, -1)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => changeQty(item.key, 1)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.lineTotal}>{money(item.product.price * item.quantity)}</Text>
            </View>
          )}
        />

        <View style={styles.summary}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Total ({itemCount} {itemCount === 1 ? 'artículo' : 'artículos'})
            </Text>
            <Text style={styles.totalValue}>{money(total)}</Text>
          </View>
          <Button
            title="Cobrar"
            variant="success"
            size="lg"
            disabled={cart.length === 0 || submitting}
            onPress={() => setPaying(true)}
          />
          <View style={styles.secondaryActions}>
            <Button
              title="Enviar sin cobrar"
              variant="secondary"
              style={styles.flex}
              disabled={cart.length === 0}
              loading={submitting && !paying}
              onPress={() => submitOrder()}
            />
            <Button
              title="Vaciar"
              variant="ghost"
              disabled={cart.length === 0 || submitting}
              onPress={clearCart}
            />
          </View>
        </View>
      </View>

      <PaymentModal
        visible={paying}
        total={total}
        loading={submitting}
        onClose={() => !submitting && setPaying(false)}
        onConfirm={(method, amountPaid) => submitOrder({ method, amountPaid })}
      />

      <PromptModal
        visible={!!noteLine}
        title={noteLine ? `Nota: ${noteLine.product.name}` : 'Nota'}
        placeholder="Ej. sin cebolla, extra salsa"
        initialValue={noteLine?.notes ?? ''}
        onClose={() => setNoteLine(null)}
        onSubmit={(value) => {
          if (noteLine) setNotes(noteLine.key, value);
          setNoteLine(null);
        }}
      />

      <AppModal
        visible={!!result}
        title="¡Orden registrada!"
        onClose={() => setResult(null)}
        width={420}
        footer={<Button title="Nueva venta" size="lg" onPress={() => setResult(null)} />}>
        {result ? (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>Ticket</Text>
            <Text style={styles.resultTicket}>#{result.ticketNumber}</Text>
            <Text style={styles.resultLine}>Total: {money(result.total)}</Text>
            {result.paymentStatus === 'PAID' ? (
              result.change ? (
                <Text style={styles.resultChange}>Cambio: {money(result.change)}</Text>
              ) : (
                <Text style={styles.resultLine}>Pagada</Text>
              )
            ) : (
              <Text style={styles.resultPending}>Pendiente de cobro</Text>
            )}
          </View>
        ) : null}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  catalog: { flex: 1, paddingTop: spacing.lg },
  toolbar: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  chips: { flexGrow: 0, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  product: {
    flex: 1,
    margin: spacing.xs + 2,
    minHeight: 110,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderTopWidth: 6,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  productName: { fontSize: 16, fontWeight: '600', color: colors.text },
  productPrice: { fontSize: 18, fontWeight: '800', color: colors.primaryDark, marginTop: spacing.sm },
  tip: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl, fontSize: 15 },

  cart: {
    width: CART_WIDTH,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    padding: spacing.lg,
  },
  cartTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  customer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  cartList: { flex: 1 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineInfo: { flex: 1, marginRight: spacing.sm },
  lineName: { fontSize: 15, fontWeight: '600', color: colors.text },
  lineNotes: { fontSize: 13, color: colors.warning, marginTop: 2 },
  addNote: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  qty: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 20, fontWeight: '700', color: colors.text },
  qtyText: { width: 30, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  lineTotal: { width: 80, textAlign: 'right', fontSize: 15, fontWeight: '600', color: colors.text },
  summary: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, color: colors.textMuted },
  totalValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  secondaryActions: { flexDirection: 'row', gap: spacing.sm },

  result: { alignItems: 'center', paddingVertical: spacing.md },
  resultLabel: { fontSize: 14, color: colors.textMuted },
  resultTicket: { fontSize: 56, fontWeight: '800', color: colors.primary },
  resultLine: { fontSize: 18, color: colors.text, marginTop: spacing.sm },
  resultChange: { fontSize: 26, fontWeight: '800', color: colors.success, marginTop: spacing.sm },
  resultPending: { fontSize: 18, fontWeight: '600', color: colors.warning, marginTop: spacing.sm },
});
