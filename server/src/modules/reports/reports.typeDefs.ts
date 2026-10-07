export const reportsTypeDefs = /* GraphQL */ `
  type PaymentMethodTotal {
    method: PaymentMethod!
    orderCount: Int!
    total: Float!
  }

  type SalesSummary {
    "Órdenes pagadas en el periodo"
    orderCount: Int!
    itemsSold: Int!
    "Ventas totales con IVA"
    grossSales: Float!
    tax: Float!
    "Ventas sin IVA"
    netSales: Float!
    averageTicket: Float!
    "Órdenes canceladas/reembolsadas en el periodo"
    cancelledCount: Int!
    byPaymentMethod: [PaymentMethodTotal!]!
  }

  type TopProduct {
    productId: ID!
    productName: String!
    quantity: Int!
    revenue: Float!
  }

  type DailySales {
    "YYYY-MM-DD en la zona horaria del negocio"
    date: String!
    orderCount: Int!
    total: Float!
  }

  type HourlySales {
    "0-23 en la zona horaria del negocio"
    hour: Int!
    orderCount: Int!
    total: Float!
  }

  # Todos los reportes aceptan un rango [from, to). Si se omiten ambos,
  # se usa el día de hoy en la zona horaria del negocio (corte del día).
  # Requieren rol ADMIN o MANAGER.
  # (GraphQL no permite descripciones sobre "extend type", por eso van como comentario.)
  extend type Query {
    "Resumen de ventas pagadas. Sin from/to = hoy"
    salesSummary(from: DateTime, to: DateTime): SalesSummary!
    "Productos más vendidos. Sin from/to = hoy"
    topProducts(from: DateTime, to: DateTime, limit: Int = 10): [TopProduct!]!
    "Ventas agrupadas por día. Sin from/to = hoy"
    salesByDay(from: DateTime, to: DateTime): [DailySales!]!
    "Ventas agrupadas por hora. Sin from/to = hoy"
    salesByHour(from: DateTime, to: DateTime): [HourlySales!]!
  }
`;
