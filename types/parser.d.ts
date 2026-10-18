export interface ParsedFunction {
  name: string;
  line: number;
  endLine: number;
  isExported: boolean;
  isAsync: boolean;
  params: Array<{ name: string; type: string | null; hasDefault: boolean }>;
  returnType: string | null;
  doc: string;
  hasContract: boolean;
  contractEffects: string[];
}

export interface ParsedClass {
  name: string;
  line: number;
  isExported: boolean;
  bases: string[];
  staticAttributes: string[];
  instanceAttributes: string[];
  methods: Array<{ name: string; line: number; isStatic: boolean }>;
}

export interface ParsedSource {
  filePath: string;
  isTypeScript: boolean;
  functions: ParsedFunction[];
  classes: ParsedClass[];
  imports: any[];
  exports: any[];
  calls: Array<{ line: number; callee: string; isDynamic: boolean }>;
  catches: Array<{ line: number; isBare: boolean; isEmpty: boolean; statementCount: number }>;
  globals: Array<{ line: number; name: string }>;
  hasDynamicCalls: boolean;
}

export function parseSource(filePath: string, code: string): ParsedSource;
