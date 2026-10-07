/**
 * nodePOS — app de punto de venta para tablet.
 * Se conecta a la API GraphQL de ../server
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppModal } from './src/components/AppModal';
import { ChangePasswordForm } from './src/components/ChangePasswordForm';
import { Sidebar, type SidebarItem } from './src/components/Sidebar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { ChangePasswordScreen } from './src/screens/ChangePasswordScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SaleScreen } from './src/screens/SaleScreen';
import { UsersScreen } from './src/screens/UsersScreen';
import { colors } from './src/theme';
import { roleLabel } from './src/utils/format';

type ScreenKey = 'sale' | 'orders' | 'reports' | 'catalog' | 'users';

function MainLayout() {
  const { user, isManager, logout } = useAuth();
  const [screen, setScreen] = useState<ScreenKey>('sale');
  const [changingPassword, setChangingPassword] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const items = useMemo<SidebarItem<ScreenKey>[]>(() => {
    const base: SidebarItem<ScreenKey>[] = [
      { key: 'sale', label: 'Venta', icon: '🛒' },
      { key: 'orders', label: 'Órdenes', icon: '🧾' },
    ];
    if (isManager) {
      base.push(
        { key: 'reports', label: 'Reportes', icon: '📊' },
        { key: 'catalog', label: 'Catálogo', icon: '🍿' },
      );
    }
    if (isAdmin) base.push({ key: 'users', label: 'Usuarios', icon: '👥' });
    return base;
  }, [isManager, isAdmin]);

  if (!user) return null;

  return (
    <View style={styles.main}>
      <Sidebar
        items={items}
        active={screen}
        onSelect={setScreen}
        userName={user.name}
        userRole={roleLabel[user.role]}
        onLogout={logout}
        onChangePassword={() => setChangingPassword(true)}
      />
      <View style={styles.content}>
        {screen === 'sale' && <SaleScreen />}
        {screen === 'orders' && <OrdersScreen />}
        {screen === 'reports' && isManager && <ReportsScreen />}
        {screen === 'catalog' && isManager && <CatalogScreen />}
        {screen === 'users' && isAdmin && <UsersScreen />}
      </View>
      <AppModal
        visible={changingPassword}
        title="Cambiar contraseña"
        onClose={() => setChangingPassword(false)}
        width={460}>
        <ChangePasswordForm
          onDone={() => setChangingPassword(false)}
          onCancel={() => setChangingPassword(false)}
        />
      </AppModal>
    </View>
  );
}

function Root() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!user) return <LoginScreen />;
  // Contraseña temporal: no se puede usar la app hasta crear una propia
  if (user.mustChangePassword) return <ChangePasswordScreen />;
  return <MainLayout />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sidebar },
  main: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sidebar },
});
