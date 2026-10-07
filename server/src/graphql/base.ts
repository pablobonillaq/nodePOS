import { GraphQLScalarType, Kind } from 'graphql';
import { z } from 'zod';
import { validate } from '../lib/errors';

/** Tipos raíz que los módulos extienden con `extend type`. */
export const baseTypeDefs = /* GraphQL */ `
  "Fecha/hora en formato ISO-8601"
  scalar DateTime

  type Query {
    "Verifica que la API responde"
    health: String!
  }

  type Mutation {
    _empty: Boolean
  }
`;

const DateTime = new GraphQLScalarType<Date | null, string>({
  name: 'DateTime',
  description: 'Fecha/hora ISO-8601',
  serialize(value) {
    const date = value instanceof Date ? value : new Date(value as string);
    return date.toISOString();
  },
  parseValue(value) {
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) throw new TypeError('DateTime inválido');
    return date;
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) return null;
    const date = new Date(ast.value);
    return Number.isNaN(date.getTime()) ? null : date;
  },
});

export const baseResolvers = {
  DateTime,
  Query: {
    health: () => 'ok',
  },
};

/** Convierte un `ID` de GraphQL (string) a entero. */
export const toId = (value: unknown): number => validate(z.coerce.number().int().positive(), value);
