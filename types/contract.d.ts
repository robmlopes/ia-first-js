export type Inputs = Record<string, unknown>;
export type Requires = (inputs: Inputs) => boolean;
export type Ensures = (result: any, inputs: Inputs) => boolean;

export interface ContractOptions {
  requires?: Requires;
  ensures?: Ensures;
  /** Effects the function may perform, e.g. `['db.write']`. */
  effects?: readonly string[];
  /** Per-parameter generators for `aif fuzz`. */
  strategies?: Record<string, unknown>;
  /** Explicit parameter names; parsed from source when omitted. */
  params?: readonly string[];
}

export interface ContractMetadata {
  effects: string[];
  requires?: Requires;
  ensures?: Ensures;
  strategies: Record<string, unknown>;
  params: string[];
}

export type Contracted<F extends (...args: any[]) => any> = F & { __aif__: ContractMetadata };

export class ContractViolation extends Error {
  constructor(kind: 'precondition' | 'postcondition', functionName: string, counterexample: Record<string, unknown>);
  kind: 'precondition' | 'postcondition';
  function: string;
  counterexample: Record<string, unknown>;
}

export function parseParams(fn: (...args: any[]) => unknown): string[];
export function contract(options?: ContractOptions): <F extends (...args: any[]) => any>(fn: F) => Contracted<F>;
export function contract<F extends (...args: any[]) => any>(options: ContractOptions, fn: F): Contracted<F>;
