// Documentos GraphQL que usa la app. Deben coincidir con el esquema de server/.

const ORDER_FIELDS = `
  id
  ticketNumber
  status
  paymentStatus
  paymentMethod
  customerName
  notes
  total
  amountPaid
  change
  createdAt
  items { id productName quantity unitPrice lineTotal notes }
`;

// ─── Auth ────────────────────────────────────────────────────────────────────
const ME_FIELDS = 'id name username role mustChangePassword';

export const LOGIN = `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      token
      user { ${ME_FIELDS} }
    }
  }
`;

export const ME = `
  query Me { me { ${ME_FIELDS} } }
`;

export const CHANGE_PASSWORD = `
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      token
      user { ${ME_FIELDS} }
    }
  }
`;

// ─── Usuarios (ADMIN) ────────────────────────────────────────────────────────
const MANAGED_USER_FIELDS = `
  id name username role active mustChangePassword
  tempPasswordExpiresAt passwordChangedAt lastLoginAt createdAt
`;

export const USERS = `
  query Users { users { ${MANAGED_USER_FIELDS} } }
`;

export const CREATE_USER = `
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      temporaryPassword
      expiresAt
      user { ${MANAGED_USER_FIELDS} }
    }
  }
`;

export const UPDATE_USER = `
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) { ${MANAGED_USER_FIELDS} }
  }
`;

export const RESET_USER_PASSWORD = `
  mutation ResetUserPassword($id: ID!) {
    resetUserPassword(id: $id) {
      temporaryPassword
      expiresAt
      user { ${MANAGED_USER_FIELDS} }
    }
  }
`;

// ─── Venta ───────────────────────────────────────────────────────────────────
export const MENU = `
  query Menu {
    categories { id name color }
    products(filter: { onlyAvailable: true }) { id name price categoryId available imageUrl }
  }
`;

export const CREATE_ORDER = `
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const PAY_ORDER = `
  mutation PayOrder($orderId: ID!, $method: PaymentMethod!, $amountPaid: Float) {
    payOrder(orderId: $orderId, method: $method, amountPaid: $amountPaid) { ${ORDER_FIELDS} }
  }
`;

// ─── Órdenes ─────────────────────────────────────────────────────────────────
export const ACTIVE_ORDERS = `
  query ActiveOrders { activeOrders { ${ORDER_FIELDS} } }
`;

export const ORDERS = `
  query Orders($filter: OrderFilter, $limit: Int) {
    orders(filter: $filter, limit: $limit) {
      totalCount
      nodes { ${ORDER_FIELDS} }
    }
  }
`;

export const UPDATE_ORDER_STATUS = `
  mutation UpdateOrderStatus($orderId: ID!, $status: OrderStatus!) {
    updateOrderStatus(orderId: $orderId, status: $status) { id status }
  }
`;

export const CANCEL_ORDER = `
  mutation CancelOrder($orderId: ID!, $reason: String!) {
    cancelOrder(orderId: $orderId, reason: $reason) { id status }
  }
`;

// ─── Reportes ────────────────────────────────────────────────────────────────
export const REPORTS = `
  query Reports($from: DateTime, $to: DateTime) {
    salesSummary(from: $from, to: $to) {
      orderCount
      itemsSold
      grossSales
      tax
      netSales
      averageTicket
      cancelledCount
      byPaymentMethod { method orderCount total }
    }
    topProducts(from: $from, to: $to, limit: 10) { productId productName quantity revenue }
    salesByHour(from: $from, to: $to) { hour orderCount total }
    salesByDay(from: $from, to: $to) { date orderCount total }
  }
`;

// ─── Catálogo ────────────────────────────────────────────────────────────────
export const CATALOG = `
  query Catalog {
    categories { id name color sortOrder }
    products { id name price categoryId available sku description imageUrl }
  }
`;

export const SET_AVAILABILITY = `
  mutation SetAvailability($id: ID!, $available: Boolean!) {
    setProductAvailability(id: $id, available: $available) { id available }
  }
`;

export const CREATE_PRODUCT = `
  mutation CreateProduct($input: CreateProductInput!) { createProduct(input: $input) { id } }
`;

export const UPDATE_PRODUCT = `
  mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
    updateProduct(id: $id, input: $input) { id }
  }
`;

export const DELETE_PRODUCT = `
  mutation DeleteProduct($id: ID!) { deleteProduct(id: $id) }
`;

export const CREATE_CATEGORY = `
  mutation CreateCategory($input: CreateCategoryInput!) { createCategory(input: $input) { id } }
`;

export const UPDATE_CATEGORY = `
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) { id }
  }
`;

export const DELETE_CATEGORY = `
  mutation DeleteCategory($id: ID!) { deleteCategory(id: $id) }
`;
