import { Injectable } from '@angular/core';
// TODO: Add ability to download remote schema
// import { Http } from '@angular/http';
// import { Observable } from 'rxjs/Observable';
// import 'rxjs/add/operator/map';

/**
 * 'JsonPointer' class
 *
 * Some utilities for using JSON Pointers with JSON objects and JSON schemas
 * https://tools.ietf.org/html/rfc6901
 *
 * JSON Pointer Functions: get, getFirst, getFromSchema, getFromFormGroup,
 * getSchemaReference, set, remove, has, dict, walk, escape, unescape,
 * parse, compile, toKey, isJsonPointer, isSubPointer, parseObjectPath
 *
 * Utility Functinos: forEach, isObject, isArray
 *
 * Based on manuelstofer's json-pointer utilities
 * https://github.com/manuelstofer/json-pointer
 */
export type Pointer = string | string[];

@Injectable()
export class JsonPointer {

  /**
   * 'get' function
   *
   * Uses a JSON Pointer to retrieve a value from an object
   *
   * @param {object} object - object to get value from
   * @param {Pointer} pointer - JSON Pointer (string or array)
   * @param {boolean = false} returnError - return only true or false for error
   * @return {object} - located value (or true or false if returnError = true)
   */
  static get(object: any, pointer: Pointer, returnError: boolean = false): any {
    let subObject = object;
    let pointerArray: any[] = this.parse(pointer);
    if (pointerArray === null) {
      if (returnError) return false;
      console.error('Unable to get object - invalid JSON Pointer: ' + pointer);
      return null;
    }
    for (let i = 0, l = pointerArray.length; i < l; ++i) {
      let key: string | number = pointerArray[i];
      if (key === '-' && isArray(subObject) && subObject.length) {
        key = subObject.length - 1;
      } else if (typeof subObject !== 'object' || !(key in subObject)) {
        if (returnError) return false;
        console.error('Unable to find "' + key + '" key in object.');
        console.error(pointer);
        console.error(object);
        return null;
      }
      subObject = subObject[key];
    }
    return returnError ? true : subObject;
  }

  /**
   * 'getFirst' function
   *
   * Takes an array of JSON Pointers and objects, and returns the value
   * from the first pointer to find a value in its object.
   *
   * @param {[object, pointer][]} items - array of objects and pointers to check
   * @return {any} - first set value
   */
  static getFirst(items: [any, Pointer][], defaultValue: any = null): any {
    if (!isArray(items)) return null;
    for (let i = 0, l = items.length; i < l; i++) {
      if (isArray(items[i]) && JsonPointer.has(items[i][0], items[i][1])) {
        return JsonPointer.get(items[i][0], items[i][1]);
      }
    }
    return defaultValue;
  }

  /**
   * 'getFromSchema' function
   *
   * Uses a JSON Pointer for a data object to retrieve a sub-schema from
   * a JSON Schema which describes that data object
   *
   * @param {JSON Schema} schema - schema to get value from
   * @param {Pointer} pointer - JSON Pointer (string or array)
   * @param {boolean = false} returnObject - return containing object instead
   * @return {schema} - located value or object
   */
  static getFromSchema(
    schema: any, pointer: Pointer, returnObject: boolean = false
  ): any {
    let subSchema = schema;
    let pointerArray: any[] = this.parse(pointer);
    if (pointerArray === null) {
      console.error('Unable to get schema - invalid JSON Pointer: ' + pointer);
      return null;
    }
    let l = returnObject ? pointerArray.length - 1 : pointerArray.length;
    for (let i = 0; i < l; ++i) {
      let parentSchema = subSchema;
      let key = pointerArray[i];
      let subSchemaArray = false;
      let subSchemaObject = false;
      if (typeof subSchema !== 'object') {
        console.error('Unable to find "' + key + '" key in schema.');
        console.error(schema);
        console.error(pointer);
        return null;
      }
      if (subSchema['type'] === 'array' && 'items' in subSchema &&
        (!isNaN(key) || key === '-')
      ) {
        subSchema = subSchema['items'];
        subSchemaArray = true;
      }
      if (subSchema['type'] === 'object' && 'properties' in subSchema) {
        subSchema = subSchema['properties'];
        subSchemaObject = true;
      }
      if (!subSchemaArray || !subSchemaObject) {
        if (subSchemaArray && key === '-') {
          subSchema = ('additionalItems' in parentSchema) ?
            parentSchema.additionalItems : {};
        } else if (typeof subSchema !== 'object' || !(key in subSchema)) {
          console.error('Unable to find "' + key + '" item in schema.');
          console.error(schema);
          console.error(pointer);
          return null;
        }
        subSchema = subSchema[key];
      }
    }
    return subSchema;
  }

  /**
   * 'getFromFormGroup' function
   *
   * Uses a JSON Pointer for a data object to retrieve a control from
   * an Angular 2 FormGroup object.
   *
   * If the optional third parameter 'returnGroup' is set to TRUE, this function
   * returns the group containing the control, rather than the control itself.
   *
   * @param {FormGroup} formGroup - Angular 2 FormGroup to get value from
   * @param {Pointer} pointer - JSON Pointer (string or array)
   * @param {boolean = false} returnGroup - if true, return group containing control
   * @return {group} - located value (or true or false if returnError = true)
   */
  static getFromFormGroup(
    formGroup: any, pointer: Pointer, returnGroup: boolean = false
  ): any {
    let subGroup = formGroup;
    let pointerArray: string[] = this.parse(pointer);
    if (pointerArray === null) {
      console.error('Unable to get FormGroup - invalid JSON Pointer: ' + pointer);
      return null;
    }
    let l = returnGroup ? pointerArray.length - 1 : pointerArray.length;
    for (let i = 0; i < l; ++i) {
      let key = pointerArray[i];
      if (subGroup.hasOwnProperty('controls')) {
        subGroup = subGroup.controls;
      }
      if (isArray(subGroup) && (key === '-')) {
        subGroup = subGroup[subGroup.length - 1];
      } else if (subGroup.hasOwnProperty(key)) {
        subGroup = subGroup[key];
      } else {
        console.error('Unable to find "' + key + '" item in FormGroup.');
        console.error(formGroup);
        console.error(pointer);
        return null;
      }
    }
    return subGroup;
  }

  /**
   * 'resolveSchemaReference' function
   *
   * @param {object | string} reference - JSON Pointer, or '$ref' object
   * @param {object} schema - the schema containing the reference
   * @param {object} referenceLibrary - optional library of resolved refernces
   * @return {object} - the refernced schema sub-section
   */
  static getSchemaReference(
    schema: any, reference: any, referenceLibrary: any = null
  ): any {
    let schemaPointer: string;
    let newSchema: any;
    if (typeof reference === 'string') {
      schemaPointer = JsonPointer.compile(reference);
    } else {
      if (!isObject(reference) || Object.keys(reference).length !== 1 ||
        !('$ref' in reference) || typeof reference.$ref !== 'string'
      ) {
        return reference;
      }
      schemaPointer = JsonPointer.compile(reference.$ref);
    }
    if (schemaPointer === '') {
      return schema;
    } else if (referenceLibrary && referenceLibrary.hasOwnProperty(schemaPointer)) {
      return referenceLibrary[schemaPointer];
    // TODO: Add ability to download remote schema, if necessary
    // } else if (schemaPointer.slice(0, 4) === 'http') {
    //    http.get(schemaPointer).subscribe(response => {
    //     // TODO: check for circular references
    //     // TODO: test and adjust to allow for for async response
    //     if (referenceLibrary) referenceLibrary[schemaPointer] = response.json();
    //     return response.json();
    //    });
    } else {
      newSchema = JsonPointer.get(schema, schemaPointer);
      // If newSchema is just an allOf array, combine array elements
      // TODO: Check and fix duplicate elements with different values
      if (isObject(newSchema) && Object.keys(newSchema).length === 1 &&
        ('allOf' in newSchema) && isArray(newSchema.allOf)
      ) {
        newSchema = newSchema.allOf
          .map(object => JsonPointer.getSchemaReference(schema, object, referenceLibrary))
          .reduce((schema1, schema2) => Object.assign(schema1, schema2), {});
      }
      if (referenceLibrary) referenceLibrary[schemaPointer] = newSchema;
      return newSchema;
    }
  }

  /**
   * 'set' function
   *
   * Uses a JSON Pointer to set a value on an object
   *
   * @param {object} object - object to set value in
   * @param {Pointer} pointer - JSON Pointer (string or array)
   * @param {any} value
   */
  static set(object: any, pointer: Pointer, value: any): any {
    let subObject: any = object;
    let pointerArray: string[] = this.parse(pointer);
    if (pointerArray === null) {
      console.error('Unable to set - invalid JSON Pointer: ' + pointer);
      return null;
    }
    for (let i = 0, l = pointerArray.length - 1; i < l; ++i) {
      let key: string = pointerArray[i];
      if (key === '-' && isArray(subObject)) key = subObject.length;
      if (!(key in subObject)) {
        subObject[key] = (pointerArray[i + 1].match(/^(\d+|-)$/)) ? [] : {};
      }
      subObject = subObject[key];
    }
    let lastKey: string = pointerArray[pointerArray.length - 1];
    if (lastKey === '-' && isArray(subObject)) lastKey = subObject.length;
    subObject[lastKey] = value;
    return object;
  }

  /**
   * 'remove' function
   *
   * Uses a JSON Pointer to remove an attribute from an object
   *
   * @param {object} object - object to delete attribute from
   * @param {Pointer} pointer - JSON Pointer (string or array)
   * @return {object}
   */
  static remove(object: any, pointer: Pointer): any {
    let pointerArray: any[] = this.parse(pointer);
    if (pointerArray === null) {
      console.error('Unable to remove - invalid JSON Pointer: ' + pointer);
      return null;
    }
    let lastKey = pointerArray[pointerArray.length - 1];
    delete this.get(object, pointerArray.slice(0, -1))[lastKey];
    return object;
  }

  /**
   * 'has' function
   *
   * Tests if an object has a value at the location specified by a JSON Pointer
   *
   * @param {object} object - object to chek for value
   * @param {Pointer} pointer - JSON Pointer (string or array)
   * @return {boolean}
   */
  static has(object: any, pointer: Pointer): boolean {
    return this.get(object, pointer, true);
  }

  /**
   * 'dict' function
   *
   * Returns a (pointer -> value) dictionary for an object
   *
   * @param {Object} obj - the object create a dictionary from
   * @return {Object} - the dictionary object
   */
  static dict(obj: any) {
    let results: any = {};
    this.walk(obj, (value, pointer) => results[pointer] = value);
    return results;
  }

  /**
   * 'walk' function
   *
   * Iterates over an object or array, recursively iterating over any
   * sub-objects or sub-arrays, and calls an iterator function on each
   * primitive value (so all strings, numbers, booleans, and nulls,
   * but not objects or arrays).
   *
   * Iterator: function (value, pointer) => any
   *
   * @param {Object} obj - the object or array to walk through
   * @param {function} fn - the iterator function to call on each value
   * @return {Object}
   */
  static walk(obj: any, fn: (v: any, p: string) => any) {
    let refTokens = [];
    (function next(cur) {
      forEach(cur, (value, key) => {
        refTokens.push(String(key));
        if (isObject(value) || isArray(value)) {
          next(value);
        } else {
          fn(value, this.compile(refTokens));
        }
        refTokens.pop();
      });
    } (obj));
  }

  /**
   * 'escape' function
   *
   * Escapes a string reference key
   *
   * @param {string} key - string key to escape
   * @return {string} - escaped key
   */
  static escape(key: string): string {
    return key.toString().replace(/~/g, '~0').replace(/\//g, '~1');
  }

  /**
   * 'unescape' function
   * Unescapes a string reference key
   *
   * @param {string} key - string key to unescape
   * @return {string} - unescaped key
   */
  static unescape(key: string): string {
    return key.toString().replace(/~1/g, '/').replace(/~0/g, '~');
  }

  /**
   * 'parse' function
   *
   * Converts a string JSON Pointer into a array of keys
   * (if input is already an an array of keys, it is returned unchanged)
   *
   * @param {Pointer} pointer - JSON Pointer (string or array)
   * @return {string[]} - JSON Pointer array of keys
   */
  static parse(pointer: Pointer): string[] {
    if (isArray(pointer)) return <string[]>pointer;
    if (typeof pointer === 'string') {
      if ((<string>pointer).charAt(0) === '#') pointer = pointer.slice(1);
      if (<string>pointer === '') return [];
      if ((<string>pointer).charAt(0) !== '/') {
        console.error('Invalid JSON Pointer, does not start with "/": ' + pointer);
        return null;
      }
      return (<string>pointer).slice(1).split('/').map(this.unescape);
    }
    console.error('Invalid JSON Pointer, not a string or array:');
    console.error(pointer);
    return null;
  }

  /**
   * 'compile' function
   *
   * Converts an array of keys into a JSON Pointer string
   * (if input is already a string, it is normalized and returned)
   *
   * The optional second parameter is a default which will replace any empty keys.
   *
   * @param {Pointer} keyArray - JSON Pointer (string or array)
   * @returns {string} - JSON Pointer string
   */
  static compile(keyArray: Pointer, defaultValue: string | number = ''): string {
    if (isArray(keyArray)) {
      if ((<string[]>keyArray).length === 0) return '';
      return '/' + (<string[]>keyArray).map(
        key => key === '' ? defaultValue : this.escape(key)
      ).join('/');
    }
    if (typeof keyArray === 'string') {
      if (keyArray.charAt(0) === '#') keyArray = keyArray.slice(1);
      if (keyArray.length && keyArray.charAt(0) !== '/') {
        console.error('Invalid JSON Pointer, does not start with "/": ' + keyArray);
        return null;
      }
      return keyArray;
    }
    console.error('Invalid JSON Pointer, not a string or array:');
    console.error(keyArray);
    return null;
  }

  /**
   * 'toKey' function
   *
   * Extracts name of the final from a JSON Pointer.
   *
   * @param {Pointer} pointer - JSON Pointer (string or array)
   * @returns {string} - the extracted key
   */
  static toKey(pointer: Pointer): string {
    let pointerArray = JsonPointer.parse(pointer);
    if (pointerArray === null) return null;
    if (!pointerArray.length) return '';
    return pointerArray[pointerArray.length - 1];
  }

  /**
   * 'isJsonPointer' function
   *
   * Checks a value to determine if it is a valid JSON Pointer.
   * This function only checks for valid JSON Pointer strings, not arrays.
   *
   * @param {any} value - value to check
   * @returns {boolean} - true if value is a valid JSON Pointer, otherwise false
   */
  static isJsonPointer(value: any): boolean {
    if (typeof value === 'string') {
      if (value === '') return true;
      if (value.charAt(0) === '#') value = value.slice(1);
      if (value.charAt(0) === '/') return true;
    }
    return false;
  }

  /**
   * 'isSubPointer' function
   *
   * Checks whether one JSON Pointer is a subset of another.
   *
   * @param {Pointer} shortPointer -
   * @param {Pointer} longPointer -
   * @return {boolean} - true if shortPointer is a subset of longPointer
   */
  static isSubPointer(
    shortPointer: Pointer, longPointer: Pointer
  ): boolean {
    let shortArray: string[] = (isArray(shortPointer)) ?
      <string[]>shortPointer : JsonPointer.parse(<string>shortPointer);
    let longArray: string[] = (isArray(longPointer)) ?
      <string[]>longPointer : JsonPointer.parse(<string>longPointer);
    if (!shortArray || !longArray) {
      console.error('Invalid JSON Pointer, not a string or array:');
      if (!shortArray) console.error(shortPointer);
      if (!longArray) console.error(longPointer);
      return null;
    }
    if (shortArray.length > longArray.length) return false;
    let isSubPointer: boolean = true;
    for (let i = 0, l = shortArray.length; i < l; i++) {
      if (shortArray[i] !== longArray[i]) {
        isSubPointer = false;
        break;
      }
    }
    return isSubPointer;
  }

  /**
   * 'parseObjectPath' function
   *
   * Parses a JavaScript object path into an array of keys, which
   * can then be passed to compile() to convert into a JSON Pointer.
   *
   * Based on mike-marcacci's objectpath parse function:
   * https://github.com/mike-marcacci/objectpath
   *
   * @param {string} objectPath - the object path to parse
   * @return {string[]} - the resulting array of keys
   */
  static parseObjectPath(objectPath: Pointer): string[] {
    if (isArray(objectPath)) return <string[]>objectPath;
    if (typeof objectPath === 'string') {
      let index: number = 0;
      let parts: string[] = [];
      while (index < objectPath.length) {
        let nextDot: number = objectPath.indexOf('.', index);
        let nextOpenBracket: number = objectPath.indexOf('[', index);
        if (nextDot === -1 && nextOpenBracket === -1) { // last item
          parts.push(objectPath.slice(index));
          index = objectPath.length;
        } else if (
          nextDot !== -1 && (nextDot < nextOpenBracket || nextOpenBracket === -1)
        ) { // dots
          parts.push(objectPath.slice(index, nextDot));
          index = nextDot + 1;
        } else { // brackets
          if (nextOpenBracket > index) {
            parts.push(objectPath.slice(index, nextOpenBracket));
            index = nextOpenBracket;
          }
          let quote: string = objectPath.charAt(nextOpenBracket + 1);
          if (quote !== '"' && quote !== "'") {
            let nextCloseBracket: number = objectPath.indexOf(']', nextOpenBracket);
            if (nextCloseBracket === -1) nextCloseBracket = objectPath.length;
            parts.push(objectPath.slice(index + 1, nextCloseBracket));
            index = nextCloseBracket + 1;
          } else {
            let nextCloseBracket: number = objectPath.indexOf(quote + ']', nextOpenBracket);
            while (nextCloseBracket !== -1 &&
              objectPath.charAt(nextCloseBracket - 1) === '\\'
            ) {
              nextCloseBracket = objectPath.indexOf(quote + ']', nextCloseBracket + 2);
            }
            if (nextCloseBracket === -1) nextCloseBracket = objectPath.length;
            parts.push(objectPath.slice(index + 2, nextCloseBracket)
            .replace(new RegExp('\\' + quote, 'g'), quote));
            index = nextCloseBracket + 2;
          }
          if (objectPath.charAt(index) === '.') index++;
        }
      }
      return parts;
    }
    console.error('parseObjectPath can only parse string paths.');
    return null;
  }
}

/**
 * 'forEach' function
 *
 * Iterates over all items in the first level of an object or array
 * and calls an iterator funciton on each item.
 *
 * Does NOT recursively iterate over items in sub-objects or sub-arrays.
 *
 * Based on manuelstofer's foreach function:
 * https://github.com/manuelstofer/foreach
 *
 * @param {Object|Array} col - collection: the object or array to iterate over
 * @param {function} fn - the iterator funciton to call on each item
 * @param {any = null} ctx - an optional context in which to call the iterator function
 * @return {void}
 */
export function forEach(
  col: any, fn: (v: any, k: string | number, c?: any) => any, ctx: any = null
): void {
  if (typeof fn !== 'function') {
    console.error('iterator must be a function');
    return;
  }
  if (!isObject(col) && !isArray(col)) {
    console.error('collection must be an object or array');
    return;
  }
  if (isArray(col)) {
    for (let i = 0, l = col.length; i < l; i++) {
      fn.call(ctx, col[i], i, col);
    }
  } else if (isObject(col)) {
    for (let key in col) {
      if (col.hasOwnProperty(key)) {
        fn.call(ctx, col[key], key, col);
      }
    }
  }
}

function isObject(item: any): boolean {
  return typeof item === 'object' &&
    Object.prototype.toString.call(item) === '[object Object]';
}

function isArray(item: any): boolean {
  return Array.isArray(item) ||
    Object.prototype.toString.call(item) === '[object Array]';
}