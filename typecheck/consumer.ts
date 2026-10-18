import {
  contract, ContractViolation, loadConfig, defaults, ConfigError, check, runStages, main, COMMANDS, stats, readLast,
  type Stage, type Io, type Config, type CheckResult, type Stats,
} from 'ia-first-js';

const transfer = contract({
  requires: ({ amount }) => (amount as number) > 0,
  ensures: (result, { balance, amount }) => result === (balance as number) - (amount as number),
  effects: ['db.write'],
})((balance: number, amount: number): number => balance - amount);

const n: number = transfer(10, 3);
const effects: string[] = transfer.__aif__.effects;

const config: Config = defaults();
const limit: number = config.limit('web/x.js', 'maxFunctionLines');
const loaded: Config = loadConfig('.');

const stage: Stage = { name: 'custom', run: async ({ root }) => [{ stage: 'custom', cause: root }] };
const result: Promise<CheckResult> = check('.', { stages: [stage], changed: true });
const staged = runStages([stage], { root: '.' });

const io: Io = { stdout: (text) => void text, stderr: (text) => void text };
const code: Promise<number> = main(['check'], io);
const all: string[] = COMMANDS;
const s: Stats = stats('.');
const last = readLast('.').status;

try {
  transfer(1, 2);
} catch (error) {
  if (error instanceof ContractViolation) {
    const kind: 'precondition' | 'postcondition' = error.kind;
    void kind;
  }
  if (error instanceof ConfigError) void error.toJSON().stage;
}

// @ts-expect-error unknown option must be rejected
contract({ requirez: () => true });
// @ts-expect-error a contract wraps functions only
contract({})(42);

void [n, effects, limit, loaded, result, staged, code, all, s, last];
