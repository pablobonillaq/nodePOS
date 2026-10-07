import { GraphQLScalarType } from 'graphql';
import { createSchema } from 'graphql-yoga';
import { authResolvers } from '../modules/auth/auth.resolvers';
import { authTypeDefs } from '../modules/auth/auth.typeDefs';
import { catalogResolvers } from '../modules/catalog/catalog.resolvers';
import { catalogTypeDefs } from '../modules/catalog/catalog.typeDefs';
import { ordersResolvers } from '../modules/orders/orders.resolvers';
import { ordersTypeDefs } from '../modules/orders/orders.typeDefs';
import { reportsResolvers } from '../modules/reports/reports.resolvers';
import { reportsTypeDefs } from '../modules/reports/reports.typeDefs';
import { baseResolvers, baseTypeDefs } from './base';
import type { GraphQLContext } from './context';

type ResolverMap = Record<string, Record<string, unknown> | unknown>;

/** Une los resolvers de cada módulo por tipo (Query, Mutation, Product...). */
function mergeResolvers(...maps: ResolverMap[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged: Record<string, any> = {};
  for (const map of maps) {
    for (const [type, fields] of Object.entries(map)) {
      if (fields && typeof fields === 'object' && !(fields instanceof GraphQLScalarType)) {
        merged[type] = { ...(merged[type] ?? {}), ...(fields as Record<string, unknown>) };
      } else {
        merged[type] = fields;
      }
    }
  }
  return merged;
}

export const schema = createSchema<GraphQLContext>({
  typeDefs: [baseTypeDefs, authTypeDefs, catalogTypeDefs, ordersTypeDefs, reportsTypeDefs],
  resolvers: mergeResolvers(baseResolvers, authResolvers, catalogResolvers, ordersResolvers, reportsResolvers),
});
