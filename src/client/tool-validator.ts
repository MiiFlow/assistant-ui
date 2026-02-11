/**
 * Client-side validator for tool definitions.
 * Validates tool definitions before they're sent to the backend.
 */

import type {
  ClientToolDefinition,
  JSONSchemaProperty,
  JSONSchemaObject,
} from "./types";

const MAX_TOOL_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 500;
const VALID_JSON_TYPES = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
]);
const TOOL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolValidationError";
  }
}

/**
 * Validates a client tool definition.
 * Throws ToolValidationError if validation fails.
 */
export function validateToolDefinition(tool: ClientToolDefinition): void {
  if (!tool.name) {
    throw new ToolValidationError("Tool name is required");
  }
  if (!tool.description) {
    throw new ToolValidationError("Tool description is required");
  }
  if (!tool.parameters) {
    throw new ToolValidationError("Tool parameters schema is required");
  }
  if (typeof tool.handler !== "function") {
    throw new ToolValidationError("Tool handler must be a function");
  }

  validateToolName(tool.name);
  validateDescription(tool.description);
  validateParametersSchema(tool.parameters);
}

function validateToolName(name: string): void {
  if (typeof name !== "string") {
    throw new ToolValidationError("Tool name must be a string");
  }
  if (name.length === 0) {
    throw new ToolValidationError("Tool name cannot be empty");
  }
  if (name.length > MAX_TOOL_NAME_LENGTH) {
    throw new ToolValidationError(
      `Tool name too long (max ${MAX_TOOL_NAME_LENGTH} characters)`
    );
  }
  if (!TOOL_NAME_PATTERN.test(name)) {
    throw new ToolValidationError(
      "Tool name must start with letter/underscore and contain only alphanumeric characters and underscores"
    );
  }
}

function validateDescription(description: string): void {
  if (typeof description !== "string") {
    throw new ToolValidationError("Tool description must be a string");
  }
  if (description.trim().length === 0) {
    throw new ToolValidationError("Tool description cannot be empty");
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ToolValidationError(
      `Tool description too long (max ${MAX_DESCRIPTION_LENGTH} characters)`
    );
  }
}

function validateParametersSchema(schema: JSONSchemaObject): void {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    throw new ToolValidationError("Parameters must be a JSON Schema object");
  }
  if (schema.type !== "object") {
    throw new ToolValidationError(
      "Parameters schema must be of type 'object' (function parameters)"
    );
  }

  if (schema.properties && typeof schema.properties === "object") {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      validatePropertySchema(propName, propSchema);
    }
  }

  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required)) {
      throw new ToolValidationError("'required' must be an array");
    }
    for (const item of schema.required) {
      if (typeof item !== "string") {
        throw new ToolValidationError(
          "'required' array must contain only strings"
        );
      }
    }
  }

  if (schema.additionalProperties !== undefined) {
    if (
      typeof schema.additionalProperties !== "boolean" &&
      (typeof schema.additionalProperties !== "object" ||
        schema.additionalProperties === null)
    ) {
      throw new ToolValidationError(
        "'additionalProperties' must be boolean or object"
      );
    }
  }
}

function validatePropertySchema(
  propName: string,
  schema: JSONSchemaProperty
): void {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    throw new ToolValidationError(
      `Property '${propName}' schema must be an object`
    );
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    for (const type of types) {
      if (!VALID_JSON_TYPES.has(type)) {
        throw new ToolValidationError(
          `Invalid type '${type}' for property '${propName}'. ` +
            `Valid types: ${Array.from(VALID_JSON_TYPES).join(", ")}`
        );
      }
    }
  }

  if (schema.enum !== undefined && !Array.isArray(schema.enum)) {
    throw new ToolValidationError(
      `Property '${propName}' enum must be an array`
    );
  }

  if (schema.properties && typeof schema.properties === "object") {
    for (const [nestedPropName, nestedPropSchema] of Object.entries(
      schema.properties
    )) {
      validatePropertySchema(`${propName}.${nestedPropName}`, nestedPropSchema);
    }
  }

  if (schema.items) {
    if (Array.isArray(schema.items)) {
      schema.items.forEach((itemSchema, index) => {
        validatePropertySchema(`${propName}[${index}]`, itemSchema);
      });
    } else {
      validatePropertySchema(`${propName}[]`, schema.items);
    }
  }
}

/**
 * Strips the handler function from a tool definition for sending to backend.
 */
export function serializeToolDefinition(
  tool: ClientToolDefinition
): Omit<ClientToolDefinition, "handler"> {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}
