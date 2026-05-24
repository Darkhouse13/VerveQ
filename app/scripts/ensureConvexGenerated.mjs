import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexDir = path.join(appDir, "convex");
const generatedDir = path.join(convexDir, "_generated");

const excludedDirs = new Set(["_generated", "data", "node_modules"]);
const excludedFiles = new Set(["auth.config.ts", "schema.ts"]);

async function collectModules(dir = convexDir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const modules = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excludedDirs.has(entry.name)) continue;
      modules.push(
        ...(await collectModules(path.join(dir, entry.name), `${prefix}${entry.name}/`)),
      );
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js")) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (!prefix && excludedFiles.has(entry.name)) continue;

    const basename = entry.name.replace(/\.(ts|js)$/, "");
    modules.push(`${prefix}${basename}`);
  }

  return modules.sort((a, b) => a.localeCompare(b));
}

function varName(moduleName) {
  return moduleName.replace(/[^A-Za-z0-9_$]/g, "_");
}

function quoteApiKey(moduleName) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(moduleName)
    ? moduleName
    : JSON.stringify(moduleName);
}

function generatedHeader(title) {
  return `/* eslint-disable */
/**
 * ${title}
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npm run codegen\`.
 * @module
 */

`;
}

function apiDts(modules) {
  const imports = modules
    .map((moduleName) => `import type * as ${varName(moduleName)} from "../${moduleName}.js";`)
    .join("\n");
  const apiMap = modules
    .map((moduleName) => `  ${quoteApiKey(moduleName)}: typeof ${varName(moduleName)};`)
    .join("\n");

  return `${generatedHeader("Generated `api` utility.")}${imports}

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
${apiMap}
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * \`\`\`js
 * const myFunctionReference = api.myModule.myFunction;
 * \`\`\`
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * \`\`\`js
 * const myFunctionReference = internal.myModule.myFunction;
 * \`\`\`
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
`;
}

const apiJs = `${generatedHeader("Generated `api` utility.")}import { anyApi, componentsGeneric } from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * \`\`\`js
 * const myFunctionReference = api.myModule.myFunction;
 * \`\`\`
 */
export const api = anyApi;
export const internal = anyApi;
export const components = componentsGeneric();
`;

const dataModelDts = `${generatedHeader("Generated data model types.")}import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their \`Id\`, which is accessible
 * on the \`_id\` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * Documents can be loaded using \`db.get(tableName, id)\` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in your tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like \`queryGeneric\` and
 * \`mutationGeneric\` to make them type-safe.
 */
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
`;

const serverJs = `${generatedHeader("Generated utilities for implementing server-side Convex query and mutation functions.")}import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";

/**
 * Define a query in this Convex app's public API.
 */
export const query = queryGeneric;

/**
 * Define a query that is only accessible from other Convex functions.
 */
export const internalQuery = internalQueryGeneric;

/**
 * Define a mutation in this Convex app's public API.
 */
export const mutation = mutationGeneric;

/**
 * Define a mutation that is only accessible from other Convex functions.
 */
export const internalMutation = internalMutationGeneric;

/**
 * Define an action in this Convex app's public API.
 */
export const action = actionGeneric;

/**
 * Define an action that is only accessible from other Convex functions.
 */
export const internalAction = internalActionGeneric;

/**
 * Define an HTTP action.
 */
export const httpAction = httpActionGeneric;
`;

const serverDts = `${generatedHeader("Generated utilities for implementing server-side Convex query and mutation functions.")}import {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

/**
 * Define a query in this Convex app's public API.
 */
export declare const query: QueryBuilder<DataModel, "public">;

/**
 * Define a query that is only accessible from other Convex functions.
 */
export declare const internalQuery: QueryBuilder<DataModel, "internal">;

/**
 * Define a mutation in this Convex app's public API.
 */
export declare const mutation: MutationBuilder<DataModel, "public">;

/**
 * Define a mutation that is only accessible from other Convex functions.
 */
export declare const internalMutation: MutationBuilder<DataModel, "internal">;

/**
 * Define an action in this Convex app's public API.
 */
export declare const action: ActionBuilder<DataModel, "public">;

/**
 * Define an action that is only accessible from other Convex functions.
 */
export declare const internalAction: ActionBuilder<DataModel, "internal">;

/**
 * Define an HTTP action.
 */
export declare const httpAction: HttpActionBuilder;

/**
 * A set of services for use within Convex query functions.
 */
export type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * A set of services for use within Convex mutation functions.
 */
export type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * A set of services for use within Convex action functions.
 */
export type ActionCtx = GenericActionCtx<DataModel>;

/**
 * An interface to read from the database within Convex query functions.
 */
export type DatabaseReader = GenericDatabaseReader<DataModel>;

/**
 * An interface to read from and write to the database within Convex mutation functions.
 */
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
`;

const modules = await collectModules();
await mkdir(generatedDir, { recursive: true });
await Promise.all([
  writeFile(path.join(generatedDir, "api.d.ts"), apiDts(modules)),
  writeFile(path.join(generatedDir, "api.js"), apiJs),
  writeFile(path.join(generatedDir, "dataModel.d.ts"), dataModelDts),
  writeFile(path.join(generatedDir, "server.d.ts"), serverDts),
  writeFile(path.join(generatedDir, "server.js"), serverJs),
]);

console.log(`Generated Convex bindings for ${modules.length} modules.`);
