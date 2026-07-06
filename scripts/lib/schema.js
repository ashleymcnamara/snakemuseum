// Zero-dependency JSON Schema (subset) validator.
//
// Supports just enough of draft-07 to validate Snake Museum's meta.json against
// games/schema.json: type, required, properties, additionalProperties (boolean),
// enum, const, minLength, maxLength, pattern, format (date, date-time, uri),
// minimum, maximum, items (single schema), minItems, maxItems, uniqueItems.
//
// Intentionally small and readable so the whole submission pipeline stays
// dependency-free. It is NOT a general-purpose validator.

import fs from "node:fs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URI_RE = /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/i;

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value; // string, number, boolean, object
}

function matchesType(value, type) {
  const actual = typeOf(value);
  if (type === "number") return actual === "number" || actual === "integer";
  if (type === "integer") return actual === "integer";
  return actual === type;
}

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  const [y, m, d] = str.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function checkFormat(value, format, path, errors) {
  if (typeof value !== "string") return;
  if (format === "date" && !isValidDate(value)) {
    errors.push(`${path}: must be an ISO date (YYYY-MM-DD), got "${value}"`);
  } else if (format === "date-time" && Number.isNaN(Date.parse(value))) {
    errors.push(`${path}: must be an ISO date-time, got "${value}"`);
  } else if (format === "uri" && !URI_RE.test(value)) {
    errors.push(`${path}: must be a valid URI, got "${value}"`);
  }
}

function validateNode(value, schema, path, errors) {
  if (!schema || typeof schema !== "object") return;

  // type
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path}: expected type ${types.join(" or ")}, got ${typeOf(value)}`);
      return; // further keyword checks are meaningless on the wrong type
    }
  }

  // const / enum
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errors.push(`${path}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    errors.push(`${path}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  }

  // string keywords
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: must be at least ${schema.minLength} character(s) long`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: must be at most ${schema.maxLength} character(s) long`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match required pattern ${schema.pattern}`);
    }
    if (schema.format) checkFormat(value, schema.format, path, errors);
  }

  // number keywords
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: must be <= ${schema.maximum}`);
    }
  }

  // array keywords
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: must have at least ${schema.minItems} item(s)`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: must have at most ${schema.maxItems} item(s)`);
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          errors.push(`${path}: items must be unique (duplicate ${key})`);
          break;
        }
        seen.add(key);
      }
    }
    if (schema.items) {
      value.forEach((item, i) => validateNode(item, schema.items, `${path}[${i}]`, errors));
    }
  }

  // object keywords
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const props = schema.properties || {};
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) errors.push(`${path === "$" ? "" : path + "."}${key}: is required`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) {
          errors.push(`${path === "$" ? "" : path + "."}${key}: is not an allowed property`);
        }
      }
    }
    for (const [key, subSchema] of Object.entries(props)) {
      if (key in value) {
        const childPath = path === "$" ? key : `${path}.${key}`;
        validateNode(value[key], subSchema, childPath, errors);
      }
    }
  }
}

/**
 * Validate `data` against `schema`.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(data, schema) {
  const errors = [];
  validateNode(data, schema, "$", errors);
  return { valid: errors.length === 0, errors };
}

/** Read and parse a JSON Schema (or any JSON) file. */
export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
