export const authTypeDefs = /* GraphQL */ `
  enum UserRole {
    ADMIN
    MANAGER
    CASHIER
  }

  type User {
    id: ID!
    name: String!
    username: String!
    role: UserRole!
    active: Boolean!
    "true = tiene una contraseña temporal que debe cambiar al iniciar sesión"
    mustChangePassword: Boolean!
    "Vencimiento de la contraseña temporal"
    tempPasswordExpiresAt: DateTime
    passwordChangedAt: DateTime
    lastLoginAt: DateTime
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  """
  Resultado de crear un usuario o restablecer su contraseña.
  La contraseña temporal solo se muestra esta vez y vence en unas horas;
  el usuario debe cambiarla en su primer inicio de sesión.
  """
  type TemporaryPasswordPayload {
    user: User!
    temporaryPassword: String!
    expiresAt: DateTime!
  }

  input CreateUserInput {
    name: String!
    username: String!
    role: UserRole = CASHIER
  }

  input UpdateUserInput {
    name: String
    role: UserRole
    active: Boolean
  }

  extend type Query {
    "Usuario autenticado actual"
    me: User
    "Lista de usuarios (solo ADMIN)"
    users: [User!]!
  }

  extend type Mutation {
    login(username: String!, password: String!): AuthPayload!
    "Cambia la contraseña propia. Obligatorio si se inició sesión con contraseña temporal"
    changePassword(currentPassword: String!, newPassword: String!): AuthPayload!

    "Solo ADMIN. Genera una contraseña temporal"
    createUser(input: CreateUserInput!): TemporaryPasswordPayload!
    "Solo ADMIN. Nombre, rol y activo/inactivo (las contraseñas no se pueden fijar)"
    updateUser(id: ID!, input: UpdateUserInput!): User!
    "Solo ADMIN. Genera una nueva contraseña temporal y cierra las sesiones del usuario"
    resetUserPassword(id: ID!): TemporaryPasswordPayload!
  }
`;
