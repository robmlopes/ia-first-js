/**
 * AST Parser using TypeScript Compiler API.
 * Parses JavaScript and TypeScript source code to extract structured symbols:
 * functions, classes, imports, exports, calls, catch blocks and globals.
 */

import ts from 'typescript';

/**
 * Extract JSDoc tags and description from comment ranges preceding a node.
 * @param {string} sourceText
 * @param {number} pos
 * @returns {{ doc: string, paramTypes: Record<string, string>, returnType: string | null }}
 */
function extractJsDoc(sourceText, pos) {
  const commentRanges = ts.getLeadingCommentRanges(sourceText, pos) || [];
  let doc = '';
  const paramTypes = {};
  let returnType = null;

  for (const range of commentRanges) {
    const comment = sourceText.slice(range.pos, range.end);
    if (comment.startsWith('/**')) {
      doc += comment + '\n';
      const lines = comment.split('\n');
      for (const line of lines) {
        const paramMatch = /@param\s+\{([^}]+)\}\s+([a-zA-Z0-9_$]+)/.exec(line);
        if (paramMatch) {
          paramTypes[paramMatch[2]] = paramMatch[1].trim();
        }
        const returnMatch = /@returns?\s+\{([^}]+)\}/.exec(line);
        if (returnMatch) {
          returnType = returnMatch[1].trim();
        }
      }
    }
  }

  return { doc: doc.trim(), paramTypes, returnType };
}

/**
 * Checks if a declaration node has an 'export' modifier.
 * @param {ts.Node} node
 * @returns {boolean}
 */
function hasExportModifier(node) {
  return Boolean(
    node.modifiers &&
    node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
  );
}

/**
 * Checks if a call expression is `contract({...})(fn)`.
 * @param {ts.CallExpression} call
 * @returns {{ hasContract: boolean, effects: string[] }}
 */
function checkContractWrapper(call) {
  let outer = call;
  let effects = [];
  let hasContract = false;
  let hasEnsures = false;

  // Pattern: contract({ effects: [...] })(fn)
  if (ts.isCallExpression(outer.expression)) {
    const innerCall = outer.expression;
    const innerName = innerCall.expression.getText();
    if (innerName === 'contract' || innerName.endsWith('.contract')) {
      hasContract = true;
      if (innerCall.arguments.length > 0 && ts.isObjectLiteralExpression(innerCall.arguments[0])) {
        const obj = innerCall.arguments[0];
        for (const prop of obj.properties) {
          if (ts.isPropertyAssignment(prop)) {
            const pName = prop.name.getText();
            if (pName === 'ensures') {
              hasEnsures = true;
            } else if (pName === 'effects') {
              if (ts.isArrayLiteralExpression(prop.initializer)) {
                effects = prop.initializer.elements
                  .filter(ts.isStringLiteral)
                  .map((el) => el.text);
              }
            }
          }
        }
      }
    }
  }

  return { hasContract, hasEnsures, effects };
}

/**
 * Parse a JS or TS file and extract rich structural information.
 * @param {string} filePath
 * @param {string} code
 */
export function parseSource(filePath, code) {
  const isTypeScript = /\.(ts|mts|tsx)$/i.test(filePath);
  const scriptKind = isTypeScript ? ts.ScriptKind.TS : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const functions = [];
  const classes = [];
  const imports = [];
  const exportsList = [];
  const calls = [];
  const catches = [];
  const globals = [];
  let hasDynamicCalls = false;

  const exportedNames = new Set();

  // First pass: scan top-level export declarations
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const el of statement.exportClause.elements) {
        exportedNames.add(el.name.text);
      }
    }
  }

  function getLine(pos) {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function processFunction(node, name, isExported, docNode = node, contractNode = null) {
    const jsdoc = extractJsDoc(code, docNode.getFullStart());
    let hasContract = false;
    let hasEnsures = false;
    let contractEffects = [];

    if (contractNode && ts.isCallExpression(contractNode)) {
      const contractInfo = checkContractWrapper(contractNode);
      hasContract = contractInfo.hasContract;
      hasEnsures = contractInfo.hasEnsures;
      contractEffects = contractInfo.effects;
    }

    const params = node.parameters.map((p) => {
      const pName = p.name.getText(sourceFile);
      const pType = p.type ? p.type.getText(sourceFile) : jsdoc.paramTypes[pName] || null;
      return {
        name: pName,
        type: pType,
        hasDefault: Boolean(p.initializer),
      };
    });

    const returnType = node.type
      ? node.type.getText(sourceFile)
      : jsdoc.returnType;

    const isAsync = Boolean(
      node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
    );

    functions.push({
      name,
      line: getLine(node.getStart(sourceFile)),
      endLine: getLine(node.getEnd()),
      isExported: isExported || exportedNames.has(name),
      isAsync,
      params,
      returnType: returnType || null,
      doc: jsdoc.doc,
      hasContract,
      hasEnsures,
      contractEffects,
    });
  }

  function processClass(node) {
    const name = node.name ? node.name.text : 'anonymous';
    const isExported = hasExportModifier(node) || exportedNames.has(name);
    const bases = [];
    const staticAttributes = [];
    const instanceAttributes = new Set();
    const methods = [];

    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            bases.push(type.expression.getText(sourceFile));
          }
        }
      }
    }

    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member)) {
        const isStatic = Boolean(
          member.modifiers && member.modifiers.some((m) => m.kind === ts.SyntaxKind.StaticKeyword),
        );
        if (isStatic && member.name) {
          staticAttributes.push(member.name.getText(sourceFile));
        }
      } else if (ts.isConstructorDeclaration(member)) {
        // Collect this.x assignments
        member.forEachChild(function visit(child) {
          if (
            ts.isBinaryExpression(child) &&
            child.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(child.left) &&
            child.left.expression.kind === ts.SyntaxKind.ThisKeyword
          ) {
            instanceAttributes.add(child.left.name.text);
          }
          child.forEachChild(visit);
        });
      } else if (ts.isMethodDeclaration(member)) {
        const mName = member.name ? member.name.getText(sourceFile) : 'anonymous';
        const isStatic = Boolean(
          member.modifiers && member.modifiers.some((m) => m.kind === ts.SyntaxKind.StaticKeyword),
        );
        methods.push({
          name: mName,
          line: getLine(member.getStart(sourceFile)),
          isStatic,
        });
      }
    }

    classes.push({
      name,
      line: getLine(node.getStart(sourceFile)),
      isExported,
      bases,
      staticAttributes,
      instanceAttributes: [...instanceAttributes],
      methods,
    });
  }

  // Traverse AST
  function visit(node) {
    // Top-level / statements inspection
    if (ts.isFunctionDeclaration(node) && node.name) {
      processFunction(node, node.name.text, hasExportModifier(node));
    } else if (ts.isClassDeclaration(node)) {
      processClass(node);
    } else if (ts.isVariableStatement(node)) {
      const isExported = hasExportModifier(node);
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isCallExpression(decl.initializer)) {
          const wrapper = checkContractWrapper(decl.initializer);
          if (wrapper.hasContract) {
            const innerArg = decl.initializer.arguments[0];
            if (innerArg && (ts.isFunctionExpression(innerArg) || ts.isArrowFunction(innerArg))) {
              const name = decl.name.getText(sourceFile);
              processFunction(innerArg, name, isExported, node, decl.initializer);
            }
          }
        }
      }
    } else if (ts.isImportDeclaration(node)) {
      const source = node.moduleSpecifier.text;
      const specifiers = [];
      if (node.importClause) {
        if (node.importClause.name) {
          specifiers.push({ name: node.importClause.name.text, alias: null, isDefault: true, isNamespace: false });
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            specifiers.push({ name: node.importClause.namedBindings.name.text, alias: null, isDefault: false, isNamespace: true });
          } else if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const el of node.importClause.namedBindings.elements) {
              specifiers.push({
                name: el.propertyName ? el.propertyName.text : el.name.text,
                alias: el.propertyName ? el.name.text : null,
                isDefault: false,
                isNamespace: false,
              });
            }
          }
        }
      }
      imports.push({ line: getLine(node.getStart(sourceFile)), source, specifiers });
    } else if (ts.isCallExpression(node)) {
      let callee = node.expression.getText(sourceFile);
      let isDynamic = false;

      if (ts.isElementAccessExpression(node.expression)) {
        isDynamic = true;
        hasDynamicCalls = true;
      }

      calls.push({
        line: getLine(node.getStart(sourceFile)),
        callee,
        isDynamic,
      });
    } else if (ts.isCatchClause(node)) {
      const isBare = !node.variableDeclaration;
      const isEmpty = node.block.statements.length === 0;
      catches.push({
        line: getLine(node.getStart(sourceFile)),
        isBare,
        isEmpty,
        statementCount: node.block.statements.length,
      });
    } else if (ts.isIdentifier(node)) {
      const text = node.text;
      if (['globalThis', 'window', 'global'].includes(text)) {
        globals.push({
          line: getLine(node.getStart(sourceFile)),
          name: text,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    filePath,
    isTypeScript,
    sourceFile,
    functions,
    classes,
    imports,
    exports: exportsList,
    calls,
    catches,
    globals,
    hasDynamicCalls,
  };
}
