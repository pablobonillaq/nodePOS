export const ordersTypeDefs = /* GraphQL */ `
  enum OrderStatus {
    PENDING
    PREPARING
    READY
    COMPLETED
    CANCELLED
  }

  enum PaymentStatus {
    UNPAID
    PAID
    REFUNDED
  }

  enum PaymentMethod {
    CASH
    CARD
    TRANSFER
  }

  type OrderItem {
    id: ID!
    productId: ID!
    product: Product
    "Nombre y precio al momento de la venta"
    productName: String!
    unitPrice: Float!
    quantity: Int!
    lineTotal: Float!
    notes: String
  }

  type Order {
    id: ID!
    "Número de ticket del día (se reinicia diario)"
    ticketNumber: Int!
    status: OrderStatus!
    paymentStatus: PaymentStatus!
    paymentMethod: PaymentMethod
    customerName: String
    notes: String
    items: [OrderItem!]!
    itemCount: Int!
    subtotal: Float!
    tax: Float!
    discount: Float!
    total: Float!
    amountPaid: Float
    change: Float
    cancelReason: String
    createdBy: User
    createdAt: DateTime!
    updatedAt: DateTime!
    paidAt: DateTime
    completedAt: DateTime
    cancelledAt: DateTime
  }

  type OrderPage {
    nodes: [Order!]!
    totalCount: Int!
  }

  input OrderItemInput {
    productId: ID!
    quantity: Int!
    "Ej. 'sin cebolla', 'extra queso'"
    notes: String
  }

  input CreateOrderInput {
    items: [OrderItemInput!]!
    customerName: String
    notes: String
  }

  input UpdateOrderItemInput {
    "0 elimina la línea"
    quantity: Int
    notes: String
  }

  input OrderFilter {
    status: [OrderStatus!]
    paymentStatus: PaymentStatus
    from: DateTime
    to: DateTime
    ticketNumber: Int
  }

  extend type Query {
    orders(filter: OrderFilter, limit: Int = 50, offset: Int = 0): OrderPage!
    order(id: ID!): Order
    "Órdenes en curso (PENDING, PREPARING, READY) — útil para la vista de cocina"
    activeOrders: [Order!]!
  }

  extend type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    addOrderItems(orderId: ID!, items: [OrderItemInput!]!): Order!
    updateOrderItem(itemId: ID!, input: UpdateOrderItemInput!): Order!
    "amountPaid es obligatorio en efectivo (para calcular el cambio)"
    payOrder(orderId: ID!, method: PaymentMethod!, amountPaid: Float): Order!
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order!
    cancelOrder(orderId: ID!, reason: String!): Order!
  }
`;
