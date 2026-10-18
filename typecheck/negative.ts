// Each line below must be rejected by the compiler (checked by test/types.test.js).
import { contract, check } from 'ia-first-js';
export const wrongType: number = check('.');
export const t = contract({})((a: number) => a);
t('not a number');
