export const catalogTypeDefs = /* GraphQL */ `
  type Category {
    id: ID!
    name: String!
    description: String
    "Color hex para el botón en la tablet, ej. #FF8800"
    color: String
    sortOrder: Int!
    active: Boolean!
    products(onlyAvailable: Boolean = false): [Product!]!
  }

  type Product {
    id: ID!
    name: String!
    description: String
    sku: String
    "Precio en pesos con IVA incluido"
    price: Float!
    imageUrl: String
    "false = agotado temporalmente"
    available: Boolean!
    active: Boolean!
    sortOrder: Int!
    categoryId: ID
    category: Category
  }

  input ProductFilter {
    categoryId: ID
    search: String
    onlyAvailable: Boolean
    includeInactive: Boolean
  }

  input CreateCategoryInput {
    name: String!
    description: String
    color: String
    sortOrder: Int
  }

  input UpdateCategoryInput {
    name: String
    description: String
    color: String
    sortOrder: Int
    active: Boolean
  }

  input CreateProductInput {
    name: String!
    price: Float!
    categoryId: ID
    description: String
    sku: String
    imageUrl: String
    available: Boolean
    sortOrder: Int
  }

  input UpdateProductInput {
    name: String
    price: Float
    categoryId: ID
    description: String
    sku: String
    imageUrl: String
    available: Boolean
    active: Boolean
    sortOrder: Int
  }

  extend type Query {
    categories(includeInactive: Boolean = false): [Category!]!
    category(id: ID!): Category
    products(filter: ProductFilter): [Product!]!
    product(id: ID!): Product
  }

  extend type Mutation {
    "ADMIN/MANAGER"
    createCategory(input: CreateCategoryInput!): Category!
    "ADMIN/MANAGER"
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    "Baja lógica. ADMIN/MANAGER"
    deleteCategory(id: ID!): Boolean!

    "ADMIN/MANAGER"
    createProduct(input: CreateProductInput!): Product!
    "ADMIN/MANAGER"
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    "Marcar como agotado / disponible. Cualquier usuario autenticado"
    setProductAvailability(id: ID!, available: Boolean!): Product!
    "Baja lógica. ADMIN/MANAGER"
    deleteProduct(id: ID!): Boolean!
  }
`;
