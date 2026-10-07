import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { errorMessage } from '../api/client';
import {
  CATALOG,
  CREATE_CATEGORY,
  CREATE_PRODUCT,
  DELETE_CATEGORY,
  DELETE_PRODUCT,
  SET_AVAILABILITY,
  UPDATE_CATEGORY,
  UPDATE_PRODUCT,
} from '../api/queries';
import type { Category, Product } from '../api/types';
import { AppModal } from '../components/AppModal';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { ErrorView, LoadingView } from '../components/ScreenState';
import { TextField } from '../components/TextField';
import { useMutation, useQuery } from '../hooks/useGraphQL';
import { categoryPalette, colors, radius, spacing } from '../theme';
import { money, parseAmount } from '../utils/format';

interface CatalogData {
  categories: Category[];
  products: Product[];
}

/** `null` = cerrado, `'new'` = crear, objeto = editar */
type Editing<T> = T | 'new' | null;

export function CatalogScreen() {
  const catalog = useQuery<CatalogData>(CATALOG);
  const [setAvailability] = useMutation(SET_AVAILABILITY);

  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Editing<Product>>(null);
  const [editingCategory, setEditingCategory] = useState<Editing<Category>>(null);

  const categories = catalog.data?.categories ?? [];
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (catalog.data?.products ?? []).filter(
      (p) =>
        (!filterCategory || p.categoryId === filterCategory) &&
        (!term || p.name.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term)),
    );
  }, [catalog.data, filterCategory, search]);

  const toggleAvailability = async (product: Product, available: boolean) => {
    try {
      await setAvailability({ id: product.id, available });
      catalog.refetch(true);
    } catch (err) {
      Alert.alert('Error', errorMessage(err));
    }
  };

  const onSaved = () => {
    setEditingProduct(null);
    setEditingCategory(null);
    catalog.refetch(true);
  };

  if (catalog.loading && !catalog.data) return <LoadingView />;
  if (catalog.error && !catalog.data) {
    return <ErrorView message={catalog.error} onRetry={() => catalog.refetch()} />;
  }

  return (
    <View style={styles.container}>
      {/* Categorías */}
      <View style={styles.categories}>
        <Text style={styles.sectionTitle}>Categorías</Text>
        <ScrollView style={styles.flex}>
          <CategoryRow
            label="Todas"
            count={catalog.data?.products.length ?? 0}
            selected={!filterCategory}
            onPress={() => setFilterCategory(null)}
          />
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              label={c.name}
              color={c.color}
              count={(catalog.data?.products ?? []).filter((p) => p.categoryId === c.id).length}
              selected={filterCategory === c.id}
              onPress={() => setFilterCategory(c.id)}
              onEdit={() => setEditingCategory(c)}
            />
          ))}
        </ScrollView>
        <Button title="+ Categoría" variant="secondary" onPress={() => setEditingCategory('new')} />
      </View>

      {/* Productos */}
      <View style={styles.products}>
        <View style={styles.toolbar}>
          <Text style={styles.title}>Productos</Text>
          <TextInput
            placeholder="Buscar por nombre o SKU…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.search}
          />
          <Button title="+ Producto" onPress={() => setEditingProduct('new')} />
        </View>

        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl refreshing={catalog.loading} onRefresh={() => catalog.refetch()} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No hay productos</Text>}
          renderItem={({ item }) => {
            const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
            return (
              <View style={[styles.productRow, !item.available && styles.soldOut]}>
                <View style={[styles.dot, { backgroundColor: category?.color ?? colors.border }]} />
                <View style={styles.flex}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productMeta}>
                    {category?.name ?? 'Sin categoría'}
                    {item.sku ? ` · ${item.sku}` : ''}
                  </Text>
                </View>
                <Text style={styles.productPrice}>{money(item.price)}</Text>
                <View style={styles.availability}>
                  <Switch
                    value={item.available}
                    onValueChange={(v) => toggleAvailability(item, v)}
                    trackColor={{ true: colors.success, false: colors.border }}
                  />
                  <Text style={styles.availabilityText}>{item.available ? 'Disponible' : 'Agotado'}</Text>
                </View>
                <Button title="Editar" size="sm" variant="secondary" onPress={() => setEditingProduct(item)} />
              </View>
            );
          }}
        />
      </View>

      <ProductForm
        editing={editingProduct}
        categories={categories}
        defaultCategoryId={filterCategory}
        onClose={() => setEditingProduct(null)}
        onSaved={onSaved}
      />
      <CategoryForm editing={editingCategory} onClose={() => setEditingCategory(null)} onSaved={onSaved} />
    </View>
  );
}

function CategoryRow({
  label,
  color,
  count,
  selected,
  onPress,
  onEdit,
}: {
  label: string;
  color?: string | null;
  count: number;
  selected: boolean;
  onPress: () => void;
  onEdit?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.categoryRow, selected && styles.categoryRowActive]}>
      <View style={[styles.dot, { backgroundColor: color ?? colors.textMuted }]} />
      <Text style={styles.categoryName} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.categoryCount}>{count}</Text>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={10} style={styles.editIcon}>
          <Text style={styles.editIconText}>✎</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// ─── Formulario de producto ──────────────────────────────────────────────────
function ProductForm({
  editing,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  editing: Editing<Product>;
  categories: Category[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [createProduct, createState] = useMutation(CREATE_PRODUCT);
  const [updateProduct, updateState] = useMutation(UPDATE_PRODUCT);
  const [deleteProduct, deleteState] = useMutation(DELETE_PRODUCT);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [available, setAvailable] = useState(true);

  const current = editing !== null && editing !== 'new' ? editing : null;
  const isEdit = current !== null;

  useEffect(() => {
    if (editing === null) return;
    if (editing === 'new') {
      setName('');
      setPrice('');
      setCategoryId(defaultCategoryId);
      setSku('');
      setDescription('');
      setAvailable(true);
    } else {
      setName(editing.name);
      setPrice(String(editing.price));
      setCategoryId(editing.categoryId);
      setSku(editing.sku ?? '');
      setDescription(editing.description ?? '');
      setAvailable(editing.available);
    }
  }, [editing, defaultCategoryId]);

  const priceValue = parseAmount(price);
  const valid = name.trim().length > 0 && Number.isFinite(priceValue) && priceValue >= 0;

  const save = async () => {
    const input = {
      name: name.trim(),
      price: priceValue,
      categoryId: categoryId ?? undefined,
      sku: sku.trim() || undefined,
      description: description.trim() || undefined,
      available,
    };
    try {
      if (current) await updateProduct({ id: current.id, input });
      else await createProduct({ input });
      onSaved();
    } catch (err) {
      Alert.alert('No se pudo guardar', errorMessage(err));
    }
  };

  const remove = () => {
    if (!current) return;
    Alert.alert('Eliminar producto', `¿Eliminar "${current.name}" del catálogo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct({ id: current.id });
            onSaved();
          } catch (err) {
            Alert.alert('Error', errorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <AppModal
      visible={editing !== null}
      title={isEdit ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      width={560}
      footer={
        <>
          {isEdit ? (
            <Button
              title="Eliminar"
              variant="danger"
              loading={deleteState.loading}
              onPress={remove}
              style={styles.footerLeft}
            />
          ) : null}
          <Button title="Cancelar" variant="secondary" onPress={onClose} />
          <Button
            title="Guardar"
            disabled={!valid}
            loading={createState.loading || updateState.loading}
            onPress={save}
          />
        </>
      }>
      <TextField label="Nombre" value={name} onChangeText={setName} />
      <View style={styles.formRow}>
        <View style={styles.flex}>
          <TextField label="Precio (IVA incluido)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
        </View>
        <View style={styles.flex}>
          <TextField label="SKU (opcional)" value={sku} onChangeText={setSku} autoCapitalize="characters" />
        </View>
      </View>
      <Text style={styles.fieldLabel}>Categoría</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formChips}>
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
      <TextField label="Descripción (opcional)" value={description} onChangeText={setDescription} multiline />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Disponible para venta</Text>
        <Switch value={available} onValueChange={setAvailable} trackColor={{ true: colors.success, false: colors.border }} />
      </View>
    </AppModal>
  );
}

// ─── Formulario de categoría ─────────────────────────────────────────────────
function CategoryForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing<Category>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [createCategory, createState] = useMutation(CREATE_CATEGORY);
  const [updateCategory, updateState] = useMutation(UPDATE_CATEGORY);
  const [deleteCategory, deleteState] = useMutation(DELETE_CATEGORY);

  const [name, setName] = useState('');
  const [color, setColor] = useState(categoryPalette[0]);
  const [sortOrder, setSortOrder] = useState('0');

  const current = editing !== null && editing !== 'new' ? editing : null;
  const isEdit = current !== null;

  useEffect(() => {
    if (editing === null) return;
    if (editing === 'new') {
      setName('');
      setColor(categoryPalette[0]);
      setSortOrder('0');
    } else {
      setName(editing.name);
      setColor(editing.color ?? categoryPalette[0]);
      setSortOrder(String(editing.sortOrder ?? 0));
    }
  }, [editing]);

  const save = async () => {
    const input = {
      name: name.trim(),
      color,
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
    };
    try {
      if (current) await updateCategory({ id: current.id, input });
      else await createCategory({ input });
      onSaved();
    } catch (err) {
      Alert.alert('No se pudo guardar', errorMessage(err));
    }
  };

  const remove = () => {
    if (!current) return;
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${current.name}"? Sus productos seguirán existiendo pero dejarán de mostrarse en esta categoría.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory({ id: current.id });
              onSaved();
            } catch (err) {
              Alert.alert('Error', errorMessage(err));
            }
          },
        },
      ],
    );
  };

  return (
    <AppModal
      visible={editing !== null}
      title={isEdit ? 'Editar categoría' : 'Nueva categoría'}
      onClose={onClose}
      width={460}
      footer={
        <>
          {isEdit ? (
            <Button title="Eliminar" variant="danger" loading={deleteState.loading} onPress={remove} style={styles.footerLeft} />
          ) : null}
          <Button title="Cancelar" variant="secondary" onPress={onClose} />
          <Button
            title="Guardar"
            disabled={!name.trim()}
            loading={createState.loading || updateState.loading}
            onPress={save}
          />
        </>
      }>
      <TextField label="Nombre" value={name} onChangeText={setName} />
      <Text style={styles.fieldLabel}>Color</Text>
      <View style={styles.palette}>
        {categoryPalette.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
          />
        ))}
      </View>
      <TextField label="Orden (menor aparece primero)" value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1 },
  categories: {
    width: 260,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  categoryRowActive: { backgroundColor: colors.primarySoft },
  categoryName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  categoryCount: { color: colors.textMuted, fontSize: 13 },
  editIcon: { paddingHorizontal: 6 },
  editIconText: { fontSize: 16, color: colors.textMuted },
  dot: { width: 12, height: 12, borderRadius: 6 },

  products: { flex: 1, padding: spacing.lg },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  search: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
  },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  soldOut: { opacity: 0.6 },
  productName: { fontSize: 16, fontWeight: '600', color: colors.text },
  productMeta: { fontSize: 13, color: colors.textMuted },
  productPrice: { width: 90, textAlign: 'right', fontSize: 16, fontWeight: '700', color: colors.text },
  availability: { alignItems: 'center', width: 90 },
  availabilityText: { fontSize: 11, color: colors.textMuted },

  formRow: { flexDirection: 'row', gap: spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  formChips: { marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 16, color: colors.text },
  footerLeft: { marginRight: 'auto' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
});
