import React, { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { CREATE_USER, RESET_USER_PASSWORD, UPDATE_USER, USERS } from '../api/queries';
import type { ManagedUser, TemporaryPasswordPayload, UserRole } from '../api/types';
import { AppModal } from '../components/AppModal';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { ErrorView, LoadingView } from '../components/ScreenState';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { useMutation, useQuery } from '../hooks/useGraphQL';
import { colors, radius, spacing } from '../theme';
import { dateTime, roleLabel } from '../utils/format';

const ROLES: UserRole[] = ['CASHIER', 'MANAGER', 'ADMIN'];

const roleDescription: Record<UserRole, string> = {
  CASHIER: 'Venta y órdenes',
  MANAGER: 'Venta, órdenes, reportes y catálogo; puede cancelar órdenes pagadas',
  ADMIN: 'Acceso total, incluida la administración de usuarios',
};

const roleColors: Record<UserRole, { bg: string; fg: string }> = {
  ADMIN: { bg: colors.primarySoft, fg: colors.primaryDark },
  MANAGER: { bg: colors.infoSoft, fg: colors.info },
  CASHIER: { bg: colors.bg, fg: colors.textMuted },
};

/** `null` = cerrado, `'new'` = crear, objeto = editar */
type Editing = ManagedUser | 'new' | null;

interface TempPasswordInfo extends TemporaryPasswordPayload {
  reason: 'created' | 'reset';
}

export function UsersScreen() {
  const { user: me } = useAuth();
  const users = useQuery<{ users: ManagedUser[] }>(USERS);
  const [updateUser] = useMutation<{ updateUser: ManagedUser }>(UPDATE_USER);
  const [resetPassword] = useMutation<{ resetUserPassword: TemporaryPasswordPayload }>(
    RESET_USER_PASSWORD,
  );

  const [editing, setEditing] = useState<Editing>(null);
  const [tempInfo, setTempInfo] = useState<TempPasswordInfo | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirmReset = (u: ManagedUser) => {
    Alert.alert(
      'Restablecer contraseña',
      `Se generará una contraseña temporal para ${u.name}. Su contraseña actual dejará de funcionar y se cerrarán sus sesiones abiertas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          style: 'destructive',
          onPress: async () => {
            setBusyId(u.id);
            try {
              const { resetUserPassword } = await resetPassword({ id: u.id });
              setTempInfo({ ...resetUserPassword, reason: 'reset' });
              users.refetch(true);
            } catch (err) {
              Alert.alert('Error', errorMessage(err));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const confirmToggleActive = (u: ManagedUser) => {
    const deactivate = u.active;
    Alert.alert(
      deactivate ? 'Desactivar usuario' : 'Activar usuario',
      deactivate
        ? `${u.name} ya no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus ventas se conservan.`
        : `${u.name} podrá volver a iniciar sesión.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: deactivate ? 'Desactivar' : 'Activar',
          style: deactivate ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(u.id);
            try {
              await updateUser({ id: u.id, input: { active: !u.active } });
              users.refetch(true);
            } catch (err) {
              Alert.alert('Error', errorMessage(err));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  if (users.loading && !users.data) return <LoadingView />;
  if (users.error && !users.data) {
    return <ErrorView message={users.error} onRetry={() => users.refetch()} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>Usuarios</Text>
          <Text style={styles.subtitle}>
            Las contraseñas las elige cada usuario. Al crear o restablecer se genera una contraseña
            temporal de un solo uso que vence en 24 horas.
          </Text>
        </View>
        <Button title="+ Usuario" onPress={() => setEditing('new')} />
      </View>

      <FlatList
        data={users.data?.users ?? []}
        keyExtractor={(u) => u.id}
        refreshControl={<RefreshControl refreshing={users.loading} onRefresh={() => users.refetch()} />}
        renderItem={({ item }) => {
          const isMe = item.id === me?.id;
          const expired =
            item.mustChangePassword &&
            item.tempPasswordExpiresAt !== null &&
            new Date(item.tempPasswordExpiresAt).getTime() < Date.now();
          return (
            <View style={[styles.row, !item.active && styles.inactive]}>
              <View style={styles.flex}>
                <Text style={styles.name}>
                  {item.name}
                  {isMe ? <Text style={styles.me}>  (tú)</Text> : null}
                </Text>
                <Text style={styles.meta}>
                  @{item.username} · Último acceso:{' '}
                  {item.lastLoginAt ? dateTime(item.lastLoginAt) : 'nunca'}
                </Text>
                <View style={styles.badges}>
                  <Badge
                    label={roleLabel[item.role]}
                    bg={roleColors[item.role].bg}
                    fg={roleColors[item.role].fg}
                  />
                  {!item.active ? <Badge label="Inactivo" bg={colors.dangerSoft} fg={colors.danger} /> : null}
                  {item.active && item.mustChangePassword ? (
                    expired ? (
                      <Badge label="Contraseña temporal vencida" bg={colors.dangerSoft} fg={colors.danger} />
                    ) : (
                      <Badge
                        label={
                          item.tempPasswordExpiresAt
                            ? `Pendiente de crear contraseña · vence ${dateTime(item.tempPasswordExpiresAt)}`
                            : 'Pendiente de crear contraseña'
                        }
                        bg={colors.warningSoft}
                        fg={colors.warning}
                      />
                    )
                  ) : null}
                </View>
              </View>
              <View style={styles.actions}>
                <Button title="Editar" size="sm" variant="secondary" onPress={() => setEditing(item)} />
                {!isMe ? (
                  <>
                    <Button
                      title="Restablecer contraseña"
                      size="sm"
                      variant="secondary"
                      disabled={!item.active}
                      loading={busyId === item.id}
                      onPress={() => confirmReset(item)}
                    />
                    <Button
                      title={item.active ? 'Desactivar' : 'Activar'}
                      size="sm"
                      variant={item.active ? 'danger' : 'success'}
                      disabled={busyId === item.id}
                      onPress={() => confirmToggleActive(item)}
                    />
                  </>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      <UserForm
        editing={editing}
        isSelf={editing !== null && editing !== 'new' && editing.id === me?.id}
        onClose={() => setEditing(null)}
        onCreated={(payload) => {
          setEditing(null);
          setTempInfo({ ...payload, reason: 'created' });
          users.refetch(true);
        }}
        onUpdated={() => {
          setEditing(null);
          users.refetch(true);
        }}
      />

      <TempPasswordModal info={tempInfo} onClose={() => setTempInfo(null)} />
    </View>
  );
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <Text style={[styles.badge, { backgroundColor: bg, color: fg }]}>{label}</Text>;
}

// ─── Crear / editar ──────────────────────────────────────────────────────────
function UserForm({
  editing,
  isSelf,
  onClose,
  onCreated,
  onUpdated,
}: {
  editing: Editing;
  isSelf: boolean;
  onClose: () => void;
  onCreated: (payload: TemporaryPasswordPayload) => void;
  onUpdated: () => void;
}) {
  const [createUser, createState] = useMutation<{ createUser: TemporaryPasswordPayload }>(CREATE_USER);
  const [updateUser, updateState] = useMutation<{ updateUser: ManagedUser }>(UPDATE_USER);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('CASHIER');

  const current = editing !== null && editing !== 'new' ? editing : null;

  useEffect(() => {
    if (editing === null) return;
    if (editing === 'new') {
      setName('');
      setUsername('');
      setRole('CASHIER');
    } else {
      setName(editing.name);
      setUsername(editing.username);
      setRole(editing.role);
    }
  }, [editing]);

  const usernameValid = /^[a-z0-9._-]{3,60}$/.test(username);
  const valid = name.trim().length > 0 && (current !== null || usernameValid);

  const save = async () => {
    try {
      if (current) {
        await updateUser({ id: current.id, input: { name: name.trim(), role } });
        onUpdated();
      } else {
        const { createUser: payload } = await createUser({
          input: { name: name.trim(), username, role },
        });
        onCreated(payload);
      }
    } catch (err) {
      Alert.alert('No se pudo guardar', errorMessage(err));
    }
  };

  return (
    <AppModal
      visible={editing !== null}
      title={current ? 'Editar usuario' : 'Nuevo usuario'}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button title="Cancelar" variant="secondary" onPress={onClose} />
          <Button
            title={current ? 'Guardar' : 'Crear y generar contraseña'}
            disabled={!valid}
            loading={createState.loading || updateState.loading}
            onPress={save}
          />
        </>
      }>
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej. María López" />
      {current ? (
        <Text style={styles.readonly}>Usuario: @{current.username}</Text>
      ) : (
        <TextField
          label="Usuario para iniciar sesión"
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="ej. maria"
        />
      )}
      {!current && username.length > 0 && !usernameValid ? (
        <Text style={styles.hintError}>
          De 3 a 60 caracteres: letras minúsculas, números, punto, guion o guion bajo.
        </Text>
      ) : null}

      <Text style={styles.fieldLabel}>Tipo de usuario</Text>
      <View style={styles.roles}>
        {ROLES.map((r) => (
          <Chip
            key={r}
            label={roleLabel[r]}
            selected={role === r}
            onPress={() => !isSelf && setRole(r)}
          />
        ))}
      </View>
      <Text style={styles.roleHint}>
        {isSelf ? 'No puedes cambiar tu propio rol.' : roleDescription[role]}
      </Text>

      {!current ? (
        <Text style={styles.info}>
          No necesitas escribir una contraseña: se generará una temporal que el usuario deberá
          cambiar por una propia la primera vez que inicie sesión.
        </Text>
      ) : null}
    </AppModal>
  );
}

// ─── Contraseña temporal (se muestra una sola vez) ───────────────────────────
function TempPasswordModal({ info, onClose }: { info: TempPasswordInfo | null; onClose: () => void }) {
  return (
    <AppModal
      visible={!!info}
      title={info?.reason === 'created' ? 'Usuario creado' : 'Contraseña restablecida'}
      onClose={onClose}
      width={500}
      footer={<Button title="Listo, ya la entregué" size="lg" onPress={onClose} />}>
      {info ? (
        <View>
          <Text style={styles.tempIntro}>
            Entrega estos datos a <Text style={styles.bold}>{info.user.name}</Text> en persona:
          </Text>
          <View style={styles.tempBox}>
            <Text style={styles.tempLabel}>Usuario</Text>
            <Text style={styles.tempUser}>{info.user.username}</Text>
            <Text style={[styles.tempLabel, styles.tempLabelSpaced]}>Contraseña temporal</Text>
            <Text style={styles.tempPassword} selectable>
              {info.temporaryPassword}
            </Text>
          </View>
          <Text style={styles.tempNote}>
            • Solo sirve para el primer inicio de sesión: el sistema le pedirá crear su propia
            contraseña de inmediato.{'\n'}• Vence el {dateTime(info.expiresAt)}.{'\n'}• Esta es la
            única vez que se muestra. Si se pierde, restablécela de nuevo.
          </Text>
        </View>
      ) : null}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  inactive: { opacity: 0.6 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  me: { fontSize: 14, fontWeight: '400', color: colors.textMuted },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.xs },

  readonly: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.md },
  hintError: { color: colors.danger, fontSize: 13, marginTop: -8, marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  roles: { flexDirection: 'row', marginBottom: spacing.sm },
  roleHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  info: {
    fontSize: 14,
    color: colors.info,
    backgroundColor: colors.infoSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },

  tempIntro: { fontSize: 15, color: colors.text, marginBottom: spacing.md },
  bold: { fontWeight: '700' },
  tempBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tempLabel: { fontSize: 13, color: colors.textMuted },
  tempLabelSpaced: { marginTop: spacing.md },
  tempUser: { fontSize: 22, fontWeight: '700', color: colors.text },
  tempPassword: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 3,
    fontFamily: 'monospace',
  },
  tempNote: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
});
