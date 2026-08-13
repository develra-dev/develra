import { parser as pythonParser } from "@lezer/python";
import ts from "typescript";

import { sortUnique } from "./path.js";
import type {
  Diagnostic,
  EndpointRef,
  Evidence,
  Language,
  OperationMatcher,
  ProviderCatalog,
  ProviderDefinition,
} from "./types.js";

export interface SourceScanResult {
  readonly evidence: readonly Evidence[];
  readonly diagnostics: readonly Diagnostic[];
}

function packageRoot(source: string): string {
  if (source.startsWith("@")) return source.split("/").slice(0, 2).join("/");
  return source.split("/", 1)[0] ?? source;
}

function shouldInspectImport(source: string): boolean {
  return (
    !source.startsWith(".") &&
    !source.startsWith("/") &&
    !source.startsWith("node:") &&
    !source.startsWith("#")
  );
}

function looksLikeExternalPackage(source: string): boolean {
  return /(?:^|[-_/@])(api|sdk|client|mcp)(?:$|[-_/])/iu.test(source);
}

function providerForImport(
  catalog: ProviderCatalog,
  language: Language,
  source: string,
): ProviderDefinition | undefined {
  const root = packageRoot(source);
  return (
    catalog.importIndex.get(`${language}:${root}`) ??
    (language === "typescript"
      ? catalog.importIndex.get(`javascript:${root}`)
      : undefined)
  );
}

function providerForHost(
  catalog: ProviderCatalog,
  host: string,
): ProviderDefinition | undefined {
  const exact = catalog.domainIndex.get(host);
  if (exact) return exact;
  for (const [domain, provider] of catalog.domainIndex) {
    if (host.endsWith(`.${domain}`)) return provider;
  }
  return undefined;
}

function sanitizeUrl(raw: string): { host: string; path: string } | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const host = url.hostname.toLowerCase();
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".test") ||
      host.endsWith(".example") ||
      host.endsWith(".invalid")
    ) {
      return undefined;
    }
    const path = url.pathname || "/";
    return { host, path };
  } catch {
    return undefined;
  }
}

function textOfLiteral(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    let result = node.head.text;
    for (const span of node.templateSpans)
      result += `{parameter}${span.literal.text}`;
    return result;
  }
  return undefined;
}

function propertyName(node: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node)
  )
    return node.text;
  return undefined;
}

function isLikelyNetworkConfiguration(node: ts.StringLiteralLike): boolean {
  const keyPattern = /(?:url|uri|host|endpoint|webhook|baseurl|base_url)$/iu;
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return keyPattern.test(parent.name.text);
  }
  if (ts.isPropertyAssignment(parent)) {
    const key = propertyName(parent.name);
    return Boolean(key && keyPattern.test(key));
  }
  return false;
}

function objectStringProperty(
  object: ts.ObjectLiteralExpression | undefined,
  key: string,
): string | undefined {
  if (!object) return undefined;
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      propertyName(property.name)?.toLowerCase() === key.toLowerCase()
    ) {
      return textOfLiteral(property.initializer);
    }
  }
  return undefined;
}

function expressionChain(
  expression: ts.Expression,
): { base: string; chain: string[] } | undefined {
  const chain: string[] = [];
  let current: ts.Expression = expression;
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current)
  ) {
    if (ts.isPropertyAccessExpression(current))
      chain.unshift(current.name.text);
    else {
      const value = textOfLiteral(current.argumentExpression);
      if (!value) return undefined;
      chain.unshift(value);
    }
    current = current.expression;
  }
  return ts.isIdentifier(current) ? { base: current.text, chain } : undefined;
}

function matcherApplies(
  matcher: OperationMatcher,
  language: Language,
  packageName: string,
  chain: readonly string[],
): boolean {
  if (
    matcher.kind === "http-endpoint" ||
    matcher.language !== language ||
    matcher.package !== packageName
  )
    return false;
  if (matcher.kind === "function-call")
    return chain.length === 1 && chain[0] === matcher.function;
  return (
    matcher.chain.length === chain.length &&
    matcher.chain.every((part, index) => part === chain[index])
  );
}

function endpointMatches(path: string, template: string): boolean {
  const left = path.split("/").filter(Boolean);
  const right = template.split("/").filter(Boolean);
  return (
    left.length === right.length &&
    right.every(
      (part, index) =>
        (part.startsWith("{") && part.endsWith("}")) || part === left[index],
    )
  );
}

function endpointOperation(
  provider: ProviderDefinition,
  language: Language,
  method: string,
  path: string,
): string | undefined {
  for (const operation of provider.operations ?? []) {
    for (const matcher of operation.matchers) {
      if (
        matcher.kind === "http-endpoint" &&
        (matcher.language === "any" || matcher.language === language) &&
        matcher.method === method &&
        endpointMatches(path, matcher.path)
      ) {
        return operation.id;
      }
    }
  }
  return undefined;
}

function getJsNetworkCall(
  call: ts.CallExpression,
): { url: string; method: string } | undefined {
  if (ts.isIdentifier(call.expression) && call.expression.text === "fetch") {
    const url = textOfLiteral(call.arguments[0]);
    if (!url) return undefined;
    const options =
      call.arguments[1] && ts.isObjectLiteralExpression(call.arguments[1])
        ? call.arguments[1]
        : undefined;
    return {
      url,
      method: objectStringProperty(options, "method")?.toUpperCase() ?? "GET",
    };
  }
  if (ts.isPropertyAccessExpression(call.expression)) {
    const owner = call.expression.expression;
    const ownerName = ts.isIdentifier(owner) ? owner.text : undefined;
    const method = call.expression.name.text.toUpperCase();
    if (
      ownerName &&
      ["axios", "got", "ky"].includes(ownerName) &&
      ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)
    ) {
      const url = textOfLiteral(call.arguments[0]);
      return url ? { url, method } : undefined;
    }
  }
  return undefined;
}

function scriptKind(
  language: "javascript" | "typescript",
  relativePath: string,
): ts.ScriptKind {
  if (language === "typescript")
    return relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return relativePath.endsWith("x") ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
}

export function scanJavascriptSource(
  text: string,
  relativePath: string,
  language: "javascript" | "typescript",
  catalog: ProviderCatalog,
): SourceScanResult {
  const source = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(language, relativePath),
  );
  const evidence: Evidence[] = [];
  const diagnostics: Diagnostic[] = [];
  const bindingPackages = new Map<string, string>();
  const sourceBindings = new Map<string, string>();
  const syntaxDiagnostics =
    (source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics ?? [];
  if (syntaxDiagnostics.length > 0) {
    diagnostics.push({
      code: "DVL_PARSE_JAVASCRIPT",
      severity: "warning",
      message: `Source contained ${syntaxDiagnostics.length} syntax diagnostic(s); recoverable evidence was retained.`,
      file: relativePath,
    });
  }

  function registerImport(
    rawSource: string,
    bindings: readonly string[],
  ): void {
    if (!shouldInspectImport(rawSource)) return;
    const importSource = packageRoot(rawSource);
    const provider = providerForImport(catalog, language, importSource);
    if (!provider && !looksLikeExternalPackage(importSource)) return;
    for (const binding of bindings) {
      sourceBindings.set(binding, importSource);
      bindingPackages.set(binding, importSource);
    }
    evidence.push({
      kind: "import",
      relativePath,
      strength: "moderate",
      importSource,
      ...(provider ? { providerId: provider.id } : {}),
      ...(bindings[0] ? { metadata: { binding: bindings[0] } } : {}),
    });
  }

  function firstPass(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const bindings: string[] = [];
      const clause = node.importClause;
      if (clause?.name) bindings.push(clause.name.text);
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings))
        bindings.push(clause.namedBindings.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        bindings.push(
          ...clause.namedBindings.elements.map((element) => element.name.text),
        );
      }
      registerImport(node.moduleSpecifier.text, bindings);
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const initializer = node.initializer;
      if (
        ts.isCallExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        initializer.expression.text === "require"
      ) {
        const requiredSource = initializer.arguments[0];
        if (!requiredSource || !ts.isStringLiteralLike(requiredSource)) {
          ts.forEachChild(node, firstPass);
          return;
        }
        const names = ts.isIdentifier(node.name)
          ? [node.name.text]
          : ts.isObjectBindingPattern(node.name)
            ? node.name.elements
                .map((element) => element.name)
                .filter(ts.isIdentifier)
                .map((identifier) => identifier.text)
            : [];
        registerImport(requiredSource.text, names);
      } else if (
        ts.isIdentifier(node.name) &&
        ts.isCallExpression(initializer) &&
        ts.isCallExpression(initializer.expression)
      ) {
        const inner = initializer.expression;
        if (
          ts.isIdentifier(inner.expression) &&
          inner.expression.text === "require"
        ) {
          const requiredSource = inner.arguments[0];
          if (requiredSource && ts.isStringLiteralLike(requiredSource)) {
            registerImport(requiredSource.text, [node.name.text]);
            bindingPackages.set(
              node.name.text,
              packageRoot(requiredSource.text),
            );
          }
        }
      } else if (
        ts.isIdentifier(node.name) &&
        (ts.isNewExpression(initializer) || ts.isCallExpression(initializer))
      ) {
        const callee = initializer.expression;
        if (ts.isIdentifier(callee)) {
          const packageName = sourceBindings.get(callee.text);
          if (packageName) bindingPackages.set(node.name.text, packageName);
        }
      } else if (ts.isIdentifier(node.name) && ts.isIdentifier(initializer)) {
        const packageName = bindingPackages.get(initializer.text);
        if (packageName) bindingPackages.set(node.name.text, packageName);
      }
    }
    ts.forEachChild(node, firstPass);
  }
  firstPass(source);

  function secondPass(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const importedSource = node.arguments[0];
        if (importedSource && ts.isStringLiteralLike(importedSource))
          registerImport(importedSource.text, []);
      }
      const chain = expressionChain(node.expression);
      if (chain) {
        const packageName = bindingPackages.get(chain.base);
        if (packageName) {
          const provider = providerForImport(catalog, language, packageName);
          for (const operation of provider?.operations ?? []) {
            if (
              operation.matchers.some((matcher) =>
                matcherApplies(matcher, language, packageName, chain.chain),
              )
            ) {
              evidence.push({
                kind: "operation-call",
                relativePath,
                strength: "strong",
                ...(provider ? { providerId: provider.id } : {}),
                operationId: operation.id,
                metadata: { binding: chain.base },
              });
            }
          }
        }
      }

      const network = getJsNetworkCall(node);
      const normalized = network ? sanitizeUrl(network.url) : undefined;
      if (network && normalized) {
        const provider = providerForHost(catalog, normalized.host);
        const endpoint: EndpointRef = {
          method: network.method,
          path: normalized.path,
          host: normalized.host,
        };
        evidence.push({
          kind: "hostname",
          relativePath,
          strength: "moderate",
          ...(provider ? { providerId: provider.id } : {}),
          endpoint,
          metadata: { networkContext: true },
        });
        const operationId = provider
          ? endpointOperation(
              provider,
              language,
              network.method,
              normalized.path,
            )
          : undefined;
        evidence.push({
          kind: "http-endpoint",
          relativePath,
          strength: provider && operationId ? "strong" : "moderate",
          ...(provider ? { providerId: provider.id } : {}),
          ...(operationId ? { operationId } : {}),
          endpoint,
          metadata: { networkContext: true },
        });
      }
    }

    if (
      (ts.isStringLiteralLike(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)) &&
      isLikelyNetworkConfiguration(node)
    ) {
      const normalized = sanitizeUrl(node.text);
      if (normalized) {
        const provider = providerForHost(catalog, normalized.host);
        evidence.push({
          kind: "hostname",
          relativePath,
          strength: "weak",
          ...(provider ? { providerId: provider.id } : {}),
          endpoint: {
            method: "GET",
            host: normalized.host,
            path: normalized.path,
          },
        });
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const key = propertyName(node.name);
      const value = textOfLiteral(node.initializer);
      if (key && value && value.length <= 256) {
        const providersInFile = new Set(
          [...bindingPackages.values()]
            .map(
              (packageName) =>
                providerForImport(catalog, language, packageName)?.id,
            )
            .filter((id): id is string => Boolean(id)),
        );
        for (const provider of catalog.providers) {
          if (!providersInFile.has(provider.id)) continue;
          if (
            provider.api_versions?.some(
              (detector) =>
                (detector.language === "any" ||
                  detector.language === language) &&
                ["object-property", "header"].includes(detector.kind) &&
                detector.key.toLowerCase() === key.toLowerCase(),
            )
          ) {
            evidence.push({
              kind: "api-version",
              relativePath,
              strength: "strong",
              providerId: provider.id,
              apiVersion: value,
            });
          }
        }
      }
    }
    ts.forEachChild(node, secondPass);
  }
  secondPass(source);

  return { evidence: deduplicateEvidence(evidence), diagnostics };
}

function hasPythonError(text: string): boolean {
  const cursor = pythonParser.parse(text).cursor();
  do {
    if (cursor.type.isError) return true;
  } while (cursor.next());
  return false;
}

function pythonCodeLines(text: string): string[] {
  const lines: string[] = [];
  let triple: "'''" | '"""' | undefined;
  for (const raw of text.split(/\r?\n/u)) {
    let line = raw;
    if (triple) {
      const end = line.indexOf(triple);
      if (end === -1) {
        lines.push("");
        continue;
      }
      line = line.slice(end + 3);
      triple = undefined;
    }
    const single = line.indexOf("'''");
    const double = line.indexOf('"""');
    const start =
      single === -1
        ? double
        : double === -1
          ? single
          : Math.min(single, double);
    if (start !== -1) {
      triple = line.slice(start, start + 3) as "'''" | '"""';
      line = line.slice(0, start);
    }
    let quote: string | undefined;
    let escaped = false;
    let result = "";
    for (const character of line) {
      if (escaped) {
        result += character;
        escaped = false;
      } else if (character === "\\") {
        result += character;
        escaped = true;
      } else if (quote) {
        result += character;
        if (character === quote) quote = undefined;
      } else if (character === "'" || character === '"') {
        quote = character;
        result += character;
      } else if (character === "#") {
        break;
      } else result += character;
    }
    lines.push(result);
  }
  return lines;
}

export function scanPythonSource(
  text: string,
  relativePath: string,
  catalog: ProviderCatalog,
): SourceScanResult {
  const diagnostics: Diagnostic[] = [];
  if (hasPythonError(text)) {
    diagnostics.push({
      code: "DVL_PARSE_PYTHON",
      severity: "warning",
      message:
        "Python source contained syntax errors; recoverable top-level evidence was retained.",
      file: relativePath,
    });
  }
  const evidence: Evidence[] = [];
  const bindings = new Map<string, string>();
  const lines = pythonCodeLines(text);

  function registerImport(source: string, binding: string): void {
    if (!shouldInspectImport(source)) return;
    const root = packageRoot(source);
    const provider = providerForImport(catalog, "python", root);
    if (!provider && !looksLikeExternalPackage(root)) return;
    bindings.set(binding, root);
    evidence.push({
      kind: "import",
      relativePath,
      strength: "moderate",
      importSource: root,
      ...(provider ? { providerId: provider.id } : {}),
      metadata: { binding },
    });
  }

  for (const line of lines) {
    const importMatch =
      /^\s*import\s+([A-Za-z_][\w.]*)(?:\s+as\s+([A-Za-z_]\w*))?/u.exec(line);
    if (importMatch?.[1])
      registerImport(
        importMatch[1],
        importMatch[2] ?? importMatch[1].split(".", 1)[0] ?? importMatch[1],
      );
    const fromMatch =
      /^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?/u.exec(
        line,
      );
    if (fromMatch?.[1] && fromMatch[2])
      registerImport(fromMatch[1], fromMatch[3] ?? fromMatch[2]);
  }

  for (const line of lines) {
    const assignment = /^\s*([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*\(/u.exec(
      line,
    );
    if (assignment?.[1] && assignment[2]) {
      const packageName = bindings.get(assignment[2]);
      if (packageName) bindings.set(assignment[1], packageName);
    }

    for (const match of line.matchAll(
      /\b([A-Za-z_]\w*)((?:\.[A-Za-z_]\w*)+)\s*\(/gu,
    )) {
      const base = match[1];
      if (!base) continue;
      const packageName = bindings.get(base);
      if (!packageName) continue;
      const chain = (match[2] ?? "").split(".").filter(Boolean);
      const provider = providerForImport(catalog, "python", packageName);
      for (const operation of provider?.operations ?? []) {
        if (
          operation.matchers.some((matcher) =>
            matcherApplies(matcher, "python", packageName, chain),
          )
        ) {
          evidence.push({
            kind: "operation-call",
            relativePath,
            strength: "strong",
            ...(provider ? { providerId: provider.id } : {}),
            operationId: operation.id,
            metadata: { binding: base },
          });
        }
      }
    }

    const request =
      /\brequests\.(get|post|put|patch|delete|head)\s*\(\s*["'](https?:\/\/[^"']+)["']/iu.exec(
        line,
      );
    if (request?.[1] && request[2]) {
      const normalized = sanitizeUrl(request[2]);
      if (normalized) {
        const method = request[1].toUpperCase();
        const provider = providerForHost(catalog, normalized.host);
        const endpoint: EndpointRef = {
          method,
          host: normalized.host,
          path: normalized.path,
        };
        const operationId = provider
          ? endpointOperation(provider, "python", method, normalized.path)
          : undefined;
        evidence.push({
          kind: "hostname",
          relativePath,
          strength: "moderate",
          ...(provider ? { providerId: provider.id } : {}),
          endpoint,
          metadata: { networkContext: true },
        });
        evidence.push({
          kind: "http-endpoint",
          relativePath,
          strength: provider && operationId ? "strong" : "moderate",
          ...(provider ? { providerId: provider.id } : {}),
          ...(operationId ? { operationId } : {}),
          endpoint,
          metadata: { networkContext: true },
        });
      }
    }

    for (const provider of catalog.providers) {
      if (
        ![...bindings.values()].some(
          (name) =>
            providerForImport(catalog, "python", name)?.id === provider.id,
        )
      )
        continue;
      for (const detector of provider.api_versions ?? []) {
        if (
          (detector.language === "any" || detector.language === "python") &&
          detector.kind === "assignment"
        ) {
          const escapedKey = detector.key.replaceAll(
            /[.*+?^${}()|[\]\\]/gu,
            "\\$&",
          );
          const versionMatch = new RegExp(
            `${escapedKey}\\s*=\\s*["']([^"']{1,256})["']`,
            "u",
          ).exec(line);
          if (versionMatch?.[1]) {
            evidence.push({
              kind: "api-version",
              relativePath,
              strength: "strong",
              providerId: provider.id,
              apiVersion: versionMatch[1],
            });
          }
        }
      }
    }
  }

  return { evidence: deduplicateEvidence(evidence), diagnostics };
}

function evidenceKey(item: Evidence): string {
  return JSON.stringify([
    item.kind,
    item.relativePath,
    item.providerId,
    item.package,
    item.operationId,
    item.endpoint,
    item.apiVersion,
    item.importSource,
  ]);
}

function deduplicateEvidence(evidence: readonly Evidence[]): Evidence[] {
  const keys = new Set<string>();
  return evidence.filter((item) => {
    const key = evidenceKey(item);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export function evidenceFiles(evidence: readonly Evidence[]): string[] {
  return sortUnique(evidence.map((item) => item.relativePath));
}
