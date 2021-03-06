/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { getType } from './get_type';
// @ts-expect-error
import { parse } from '../../../grammar';

export type ExpressionArgAST = string | boolean | number | Ast;

export interface ExpressionFunctionAST {
  type: 'function';
  function: string;
  arguments: {
    [key: string]: ExpressionArgAST[];
  };
}

export interface Ast {
  /** @internal */
  function: any;
  /** @internal */
  arguments: any;
  type: 'expression';
  chain: ExpressionFunctionAST[];
  /** @internal */
  replace(regExp: RegExp, s: string): string;
}

function getArgumentString(arg: Ast, argKey: string | undefined, level = 0) {
  const type = getType(arg);

  // eslint-disable-next-line @typescript-eslint/no-shadow
  function maybeArgKey(argKey: string | null | undefined, argString: string) {
    return argKey == null || argKey === '_' ? argString : `${argKey}=${argString}`;
  }

  if (type === 'string') {
    // correctly (re)escape double quotes
    const escapedArg = arg.replace(/[\\"]/g, '\\$&'); // $& means the whole matched string
    return maybeArgKey(argKey, `"${escapedArg}"`);
  }

  if (type === 'boolean' || type === 'null' || type === 'number') {
    // use values directly
    return maybeArgKey(argKey, `${arg}`);
  }

  if (type === 'expression') {
    // build subexpressions
    return maybeArgKey(argKey, `{${getExpression(arg.chain, level + 1)}}`);
  }

  // unknown type, throw with type value
  throw new Error(`Invalid argument type in AST: ${type}`);
}

function getExpressionArgs(block: Ast, level = 0) {
  const args = block.arguments;
  const hasValidArgs = typeof args === 'object' && args != null && !Array.isArray(args);

  if (!hasValidArgs) throw new Error('Arguments can only be an object');

  const argKeys = Object.keys(args);
  const MAX_LINE_LENGTH = 80; // length before wrapping arguments
  return argKeys.map((argKey) =>
    args[argKey].reduce((acc: any, arg: any) => {
      const argString = getArgumentString(arg, argKey, level);
      const lineLength = acc.split('\n').pop().length;

      // if arg values are too long, move it to the next line
      if (level === 0 && lineLength + argString.length > MAX_LINE_LENGTH) {
        return `${acc}\n  ${argString}`;
      }

      // append arg values to existing arg values
      if (lineLength > 0) return `${acc} ${argString}`;

      // start the accumulator with the first arg value
      return argString;
    }, '')
  );
}

function fnWithArgs(fnName: any, args: any[]) {
  if (!args || args.length === 0) return fnName;
  return `${fnName} ${args.join(' ')}`;
}

function getExpression(chain: any[], level = 0) {
  if (!chain) throw new Error('Expressions must contain a chain');

  // break new functions onto new lines if we're not in a nested/sub-expression
  const separator = level > 0 ? ' | ' : '\n| ';

  return chain
    .map((chainObj) => {
      const type = getType(chainObj);

      if (type === 'function') {
        const fn = chainObj.function;
        if (!fn || fn.length === 0) throw new Error('Functions must have a function name');

        const expArgs = getExpressionArgs(chainObj, level);

        return fnWithArgs(fn, expArgs);
      }
    }, [])
    .join(separator);
}

export function fromExpression(expression: string, type = 'expression'): Ast {
  try {
    return parse(String(expression), { startRule: type });
  } catch (e) {
    throw new Error(`Unable to parse expression: ${e.message}`);
  }
}

// TODO: OMG This is so bad, we need to talk about the right way to handle bad expressions since some are element based and others not
export function safeElementFromExpression(expression: string) {
  try {
    return fromExpression(expression);
  } catch (e) {
    return fromExpression(
      `markdown
"## Crud.
Canvas could not parse this element's expression. I am so sorry this error isn't more useful. I promise it will be soon.

Thanks for understanding,
#### Management
"`
    );
  }
}

// TODO: Respect the user's existing formatting
export function toExpression(astObj: Ast, type = 'expression'): string {
  if (type === 'argument') {
    // @ts-ignore
    return getArgumentString(astObj);
  }

  const validType = ['expression', 'function'].includes(getType(astObj));
  if (!validType) throw new Error('Expression must be an expression or argument function');

  if (getType(astObj) === 'expression') {
    if (!Array.isArray(astObj.chain)) throw new Error('Expressions must contain a chain');

    return getExpression(astObj.chain);
  }

  const expArgs = getExpressionArgs(astObj);
  return fnWithArgs(astObj.function, expArgs);
}
