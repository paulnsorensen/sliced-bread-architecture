// TypeScript backend: per-slice depth metrics from one compiler program.
// Definitions live in ../../references/metrics.md; keep the two in step and
// bump MEASUREMENT_VERSION when a definition changes what a number means.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import ts from 'typescript'

export const MEASUREMENT_VERSION = 1
export const SIZE_AWARE = { crustLogicStatements: 200, share: { num: 1, den: 2 } }

const K = ts.SyntaxKind
const SOURCE = /\.(?:ts|tsx|mts|cts)$/
const DECLARATION_FILE = /\.d\.(?:ts|mts|cts)$/
const BRANCH_OPERATORS = new Set([
  K.AmpersandAmpersandToken,
  K.BarBarToken,
  K.QuestionQuestionToken,
  K.AmpersandAmpersandEqualsToken,
  K.BarBarEqualsToken,
  K.QuestionQuestionEqualsToken,
])

export class AnalysisError extends Error {}

function walkFiles(root, dir, out) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = dir ? `${dir}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walkFiles(root, path, out)
    } else if (SOURCE.test(entry.name) && !DECLARATION_FILE.test(entry.name)) out.push(path)
  }
}

function inventory(root, model) {
  const files = new Set()
  for (const node of model.nodes) {
    for (const path of node.paths) {
      let stat
      try {
        stat = statSync(join(root, path))
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        const found = []
        walkFiles(root, path, found)
        found.forEach((f) => files.add(f))
      } else if (SOURCE.test(path)) files.add(path)
    }
  }
  return [...files].filter((f) => !model.isIgnored(f)).sort()
}

function compilerOptions(root, model) {
  if (!model.tsconfig)
    return {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
    }
  const parsed = ts.getParsedCommandLineOfConfigFile(
    join(root, model.tsconfig),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new AnalysisError(
          `${model.tsconfig}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`,
        )
      },
    },
  )
  if (parsed.errors.length) {
    throw new AnalysisError(
      `${model.tsconfig}: ${ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, '\n')}`,
    )
  }
  return { ...parsed.options, noEmit: true }
}

const isFunctionWithBody = (n) =>
  (ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n) ||
    ts.isClassStaticBlockDeclaration(n)) &&
  n.body !== undefined

const isStatementKind = (n) => n.kind >= K.FirstStatement && n.kind <= K.LastStatement

/** Decision points of one node, not counting nested functions (they are their own unit). */
function decisionAt(n) {
  switch (n.kind) {
    case K.IfStatement:
    case K.ConditionalExpression:
    case K.ForStatement:
    case K.ForInStatement:
    case K.ForOfStatement:
    case K.WhileStatement:
    case K.DoStatement:
    case K.CatchClause:
    case K.CaseClause:
      return 1
    case K.BinaryExpression:
      return BRANCH_OPERATORS.has(n.operatorToken.kind) ? 1 : 0
    case K.PropertyAccessExpression:
    case K.ElementAccessExpression:
    case K.CallExpression:
      return n.questionDotToken ? 1 : 0
    case K.Parameter:
    case K.BindingElement:
      return n.initializer ? 1 : 0
    default:
      return 0
  }
}

/** Logical statements and complexity of one function-like unit (its own code only). */
function measureFunction(fn) {
  let statements = ts.isArrowFunction(fn) && !ts.isBlock(fn.body) ? 1 : 0
  let decisions = 0
  const visit = (n) => {
    if (n !== fn && isFunctionWithBody(n)) return
    if (n !== fn) {
      if (isStatementKind(n) && insideBody(n, fn)) statements++
      decisions += decisionAt(n)
    }
    ts.forEachChild(n, visit)
  }
  visit(fn)
  return { statements, complexity: 1 + decisions }
}

function insideBody(n, fn) {
  for (let p = n.parent; p && p !== fn; p = p.parent) if (p === fn.body) return true
  return n.parent === fn.body
}

function isTypePosition(id) {
  for (let p = id.parent; p && !ts.isSourceFile(p); p = p.parent) {
    if (ts.isHeritageClause(p)) {
      return p.token === K.ImplementsKeyword || ts.isInterfaceDeclaration(p.parent)
    }
    if (ts.isExpressionWithTypeArguments(p)) continue
    if (ts.isTypeNode(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p))
      return true
    if (isFunctionWithBody(p) || ts.isBlock(p)) return false
  }
  return false
}

/** Strip wrappers that do not change what an expression evaluates to. */
function unwrap(n) {
  while (
    n &&
    (ts.isParenthesizedExpression(n) ||
      ts.isAsExpression(n) ||
      ts.isSatisfiesExpression(n) ||
      ts.isNonNullExpression(n) ||
      ts.isTypeAssertionExpression(n))
  ) {
    n = n.expression
  }
  return n
}

/** Static field initializers that run code when the class is defined (not functions or literals). */
function staticInitializers(cls) {
  return cls.members.filter(
    (m) =>
      ts.isPropertyDeclaration(m) &&
      m.modifiers?.some((x) => x.kind === K.StaticKeyword) &&
      m.initializer &&
      !isFunctionInit(m.initializer) &&
      !ts.isLiteralExpression(unwrap(m.initializer)),
  ).length
}

/** A class expression runs code at definition when it has a static block or static initializer. */
const runsAtDefinition = (cls) =>
  staticInitializers(cls) > 0 || cls.members.some((m) => ts.isClassStaticBlockDeclaration(m))

const isFunctionInit = (init) => {
  const n = unwrap(init)
  return !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isClassExpression(n))
}

/**
 * An initializer that runs no code when evaluated: a function, a class expression without
 * static initializers or static blocks, or a call-free object or array literal.
 */
const isInertInit = (init) => {
  const n = unwrap(init)
  if (n && ts.isClassExpression(n)) return !runsAtDefinition(n)
  return (
    isFunctionInit(n) ||
    (!!n && (ts.isObjectLiteralExpression(n) || ts.isArrayLiteralExpression(n)) && !hasCall(n))
  )
}

/** Liveness unit: code reached only through a reference, not by running its parent. */
function isUnit(n) {
  if (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) return true
  if (ts.isVariableDeclaration(n)) return isInertInit(n.initializer)
  if (
    ts.isMethodDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n)
  ) {
    return ts.isClassLike(n.parent)
  }
  return false
}

const REFLECTIVE_OBJECT = new Set([
  'values',
  'entries',
  'getOwnPropertyNames',
  'getOwnPropertyDescriptors',
  'getPrototypeOf',
])

/** Calls that reach members by computed name: Reflect.*, eval, Function, Object.values and kin. */
function isReflective(n) {
  if (ts.isNewExpression(n))
    return ts.isIdentifier(n.expression) && n.expression.text === 'Function'
  if (!ts.isCallExpression(n)) return false
  const callee = n.expression
  if (ts.isIdentifier(callee)) return callee.text === 'eval' || callee.text === 'Function'
  if (!ts.isPropertyAccessExpression(callee) || !ts.isIdentifier(callee.expression)) return false
  const target = callee.expression.text
  return target === 'Reflect' || (target === 'Object' && REFLECTIVE_OBJECT.has(callee.name.text))
}

function at(file, sf, n, what) {
  const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf))
  return `${file}:${line + 1} ${what}`
}

function skipSubtree(n) {
  if (ts.isImportDeclaration(n) || ts.isImportEqualsDeclaration(n)) return true
  if (ts.isExportDeclaration(n)) return true
  if (ts.isExportAssignment(n) && ts.isIdentifier(n.expression)) return true
  return ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)
}

function fraction(num, den) {
  return den === 0 ? { num: 0, den: 1 } : { num, den }
}

export function greater(a, b) {
  return a.num * b.den > b.num * a.den
}

export function analyze(root, model) {
  const files = inventory(root, model)
  for (const slice of model.slices) {
    for (const crust of slice.crust) {
      if (!files.includes(crust))
        throw new AnalysisError(`${slice.name}: crust file ${crust} does not exist`)
    }
  }
  const program = ts.createProgram(
    files.map((f) => join(root, f)),
    compilerOptions(root, model),
  )
  const checker = program.getTypeChecker()
  const rel = (sf) => relative(root, sf.fileName).split(sep).join('/')
  const sources = new Map()
  for (const file of files) {
    const sf = program.getSourceFile(join(root, file))
    if (!sf) throw new AnalysisError(`${file}: not in the compiler program`)
    sources.set(file, sf)
  }
  for (const slice of model.slices) {
    for (const crust of slice.crust) {
      if (sources.get(crust).statements.some((s) => ts.isExportAssignment(s) && s.isExportEquals)) {
        throw new AnalysisError(
          `${slice.name}: crust ${crust} uses \`export =\`, which measurement version ${MEASUREMENT_VERSION} does not support`,
        )
      }
    }
  }
  const fileOf = (node) => {
    const sf = node.getSourceFile()
    const path = rel(sf)
    return sources.has(path) ? path : null
  }
  // Files a slice imports that the tool cannot measure (JavaScript, declaration files).
  const unmeasured = new Map(files.map((f) => [f, []]))
  const resolveModule = (specifier, from) => {
    if (specifier.text.startsWith('.')) {
      const path = posix.join(posix.dirname(from), specifier.text)
      if (/\.[cm]?jsx?$/.test(path) && model.owner(path) && existsSync(join(root, path))) {
        unmeasured.get(from).push(path)
      }
    }
    const symbol = checker.getSymbolAtLocation(specifier)
    const decl = symbol?.valueDeclaration ?? symbol?.declarations?.[0]
    if (!decl || !ts.isSourceFile(decl)) return null
    const measured = fileOf(decl)
    if (measured) return measured
    const path = rel(decl)
    if (model.owner(path)) unmeasured.get(from).push(path)
    return null
  }

  // Module edges: [{ from, to, runtime, node }] for every static and dynamic import form.
  const imports = new Map(files.map((f) => [f, []]))
  for (const [file, sf] of sources) {
    const visit = (n) => {
      let spec = null
      let runtime = true
      if (ts.isImportDeclaration(n)) {
        spec = n.moduleSpecifier
        runtime = !n.importClause?.isTypeOnly
      } else if (ts.isExportDeclaration(n) && n.moduleSpecifier) {
        spec = n.moduleSpecifier
        runtime = !n.isTypeOnly
      } else if (
        ts.isImportEqualsDeclaration(n) &&
        ts.isExternalModuleReference(n.moduleReference)
      ) {
        spec = n.moduleReference.expression
      } else if (
        ts.isCallExpression(n) &&
        n.expression.kind === K.ImportKeyword &&
        n.arguments[0]
      ) {
        spec = n.arguments[0]
      } else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) {
        spec = n.argument.literal
        runtime = false
      }
      if (spec && ts.isStringLiteralLike(spec)) {
        const to = resolveModule(spec, file)
        if (to) imports.get(file).push({ to, runtime, node: n })
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }

  // Production files: non-test files, plus any test-pattern file they reach (transitively).
  const production = new Set(files.filter((f) => !model.isTest(f)))
  for (let queue = [...production]; queue.length;) {
    for (const { to } of imports.get(queue.pop())) {
      if (!production.has(to)) {
        production.add(to)
        queue.push(to)
      }
    }
  }

  // Units, ownership, per-function measures.
  const unitOf = new Map() // ts.Node -> unit id
  const units = [] // { id, file, label }
  const initUnit = new Map() // file -> unit id of its module initializer
  const newUnit = (file, label) => units.push({ id: units.length, file, label }) - 1
  const functions = [] // { file, unit, statements, complexity }
  const moduleInit = new Map() // file -> executable top-level statements (reported, not counted)
  const ownerOf = (n, file) => {
    for (let p = n; p && !ts.isSourceFile(p); p = p.parent) if (unitOf.has(p)) return unitOf.get(p)
    return initUnit.get(file)
  }
  for (const file of production) {
    const sf = sources.get(file)
    initUnit.set(file, newUnit(file, '<module>'))
    const visit = (n) => {
      if (isUnit(n)) unitOf.set(n, newUnit(file, n.name?.getText(sf) ?? '<anonymous>'))
      ts.forEachChild(n, visit)
    }
    visit(sf)
    let init = 0
    for (const stmt of sf.statements) {
      if (isStatementKind(stmt) && !ts.isVariableStatement(stmt)) init++
      else if (ts.isVariableStatement(stmt)) {
        for (const d of stmt.declarationList.declarations) {
          const value = unwrap(d.initializer)
          if (value && ts.isClassExpression(value)) init += staticInitializers(value)
          else if (value && !isFunctionInit(value) && hasCall(value)) init++
        }
      } else if (ts.isClassDeclaration(stmt)) init += staticInitializers(stmt)
    }
    moduleInit.set(file, init)
    const collect = (n) => {
      if (isFunctionWithBody(n))
        functions.push({ file, unit: ownerOf(n, file), ...measureFunction(n) })
      ts.forEachChild(n, collect)
    }
    collect(sf)
  }

  // Reference edges between units (runtime positions only).
  const edges = units.map(() => new Set())
  const methodsByName = new Map() // name -> [{ unit, instance type }] for class methods and accessors
  const structuralNames = [] // [owner, name, receiver type] for member accesses that may dispatch
  const declUnits = (symbol) => {
    if (!symbol) return []
    let target = symbol
    if (target.flags & ts.SymbolFlags.Alias) target = checker.getAliasedSymbol(target)
    return (target.declarations ?? []).flatMap((d) => {
      const file = fileOf(d)
      if (!file || !production.has(file)) return []
      return [unitOf.has(d) ? unitOf.get(d) : ownerOf(d, file)]
    })
  }
  const dynamic = new Map(files.map((f) => [f, []]))
  for (const file of production) {
    const sf = sources.get(file)
    const visit = (n) => {
      if (skipSubtree(n)) return
      if (
        (ts.isMethodDeclaration(n) ||
          ts.isGetAccessorDeclaration(n) ||
          ts.isSetAccessorDeclaration(n)) &&
        unitOf.has(n)
      ) {
        const name = n.name.getText(sf)
        const cls = n.parent
        const classSymbol = cls.name ? checker.getSymbolAtLocation(cls.name) : undefined
        const instance = classSymbol ? checker.getDeclaredTypeOfSymbol(classSymbol) : undefined
        if (!methodsByName.has(name)) methodsByName.set(name, [])
        methodsByName.get(name).push({ unit: unitOf.get(n), instance })
      }
      if (ts.isClassLike(n)) {
        const ext = n.heritageClauses?.find((h) => h.token === K.ExtendsKeyword)?.types[0]
        if (ext && unitOf.has(n)) {
          const external = declUnits(checker.getSymbolAtLocation(ext.expression)).length === 0
          if (external) {
            for (const m of n.members) if (unitOf.has(m)) edges[unitOf.get(n)].add(unitOf.get(m))
          }
        }
      }
      if (
        ts.isElementAccessExpression(n) &&
        !ts.isStringLiteralLike(n.argumentExpression) &&
        !ts.isNumericLiteral(n.argumentExpression)
      ) {
        // A key whose type is a string literal (or a union of them) is resolved by name.
        const keyType = checker.getTypeAtLocation(n.argumentExpression)
        const keys = (keyType.isUnion() ? keyType.types : [keyType]).map((t) =>
          t.isStringLiteral() ? t.value : null,
        )
        if (keys.every((k) => k !== null)) {
          const owner = ownerOf(n, file)
          const receiver = checker.getTypeAtLocation(n.expression)
          for (const key of keys) {
            const prop = receiver.getProperty(key)
            for (const t of declUnits(prop)) if (t !== owner) edges[owner].add(t)
            structuralNames.push([owner, key, receiver])
          }
        } else dynamic.get(file).push(at(file, sf, n, 'computed key'))
      }
      if (isReflective(n)) dynamic.get(file).push(at(file, sf, n, n.expression.getText(sf)))
      const named =
        ts.isIdentifier(n) ||
        ts.isPrivateIdentifier(n) ||
        (ts.isStringLiteralLike(n) && ts.isElementAccessExpression(n.parent))
      if (named && !isTypePosition(n) && !isDeclarationName(n)) {
        const owner = ownerOf(n, file)
        let symbol = checker.getSymbolAtLocation(n)
        if (ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n) {
          symbol = checker.getShorthandAssignmentValueSymbol(n.parent)
        }
        const targets = declUnits(symbol)
        for (const t of targets) if (t !== owner) edges[owner].add(t)
        const access = n.parent
        const member =
          (ts.isPropertyAccessExpression(access) && access.name === n) ||
          ts.isElementAccessExpression(access)
        if (member) {
          // Even a class-member hit may dispatch to a subclass or a structurally compatible class.
          const receiver = checker.getTypeAtLocation(access.expression)
          structuralNames.push([
            owner,
            ts.isStringLiteralLike(n) ? n.text : n.getText(sf),
            receiver,
          ])
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  // A member access through an interface, a base class, or an untyped value may dispatch to a
  // same-name method of any class whose instances the receiver type admits; link those methods
  // (conservative: keeps them live). An `any`, `unknown`, or generic receiver admits every class.
  for (const [owner, name, receiver] of structuralNames) {
    const open =
      !receiver ||
      receiver.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)
    for (const m of methodsByName.get(name) ?? []) {
      if (m.unit === owner) continue
      if (open || !m.instance || checker.isTypeAssignableTo(m.instance, receiver))
        edges[owner].add(m.unit)
    }
  }

  const sliceOf = (file) => model.owner(file)
  const result = {}
  for (const slice of model.slices) {
    const mine = (file) => sliceOf(file) === slice
    const crust = new Set(slice.crust)
    const sliceFiles = [...production].filter(mine)

    // Loaded files: crust files and slice files imported from outside, closed over runtime imports.
    const loaded = new Set(slice.crust)
    for (const file of production) {
      if (!mine(file))
        for (const e of imports.get(file)) if (e.runtime && mine(e.to)) loaded.add(e.to)
    }
    for (let queue = [...loaded]; queue.length;) {
      for (const e of imports.get(queue.pop())) {
        if (e.runtime && mine(e.to) && production.has(e.to) && !loaded.has(e.to)) {
          loaded.add(e.to)
          queue.push(e.to)
        }
      }
    }

    // Roots: everything outside the slice, every unit in a crust file, crust export targets,
    // and the module initializer of every loaded file.
    const live = new Set()
    const queue = []
    const mark = (u) => {
      if (!live.has(u)) {
        live.add(u)
        queue.push(u)
      }
    }
    for (const u of units) if (!mine(u.file) || crust.has(u.file)) mark(u.id)
    for (const file of loaded) if (initUnit.has(file)) mark(initUnit.get(file))
    const surface = []
    for (const file of slice.crust) {
      const moduleSymbol = checker.getSymbolAtLocation(sources.get(file))
      const exports = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []
      for (const symbol of exports) {
        declUnits(symbol).forEach(mark)
        const target =
          symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
        const value = (target.flags & ts.SymbolFlags.Value) !== 0
        const type = (target.flags & ts.SymbolFlags.Type) !== 0
        surface.push({
          file,
          name: symbol.escapedName.toString(),
          kind: value && type ? 'dual' : value ? 'value' : 'type',
        })
      }
    }
    while (queue.length) for (const t of edges[queue.pop()]) mark(t)

    const sum = (list, key) => list.reduce((acc, f) => acc + f[key], 0)
    const crustFns = functions.filter((f) => crust.has(f.file))
    const internalFns = functions.filter((f) => mine(f.file) && !crust.has(f.file))
    const liveInternal = internalFns.filter((f) => live.has(f.unit))
    const deadInternal = internalFns.filter((f) => !live.has(f.unit))
    const crustLoc = sum(crustFns, 'statements')
    const sliceLoc = crustLoc + sum(liveInternal, 'statements')
    const crustCc = sum(crustFns, 'complexity')
    const sliceCc = crustCc + sum(liveInternal, 'complexity')
    const unused = unusedExports(slice, surface)
    const share = fraction(crustLoc, sliceLoc)
    const owning = new Set(functions.map((f) => f.unit))
    const deadUnits = units.filter(
      (u) => mine(u.file) && !crust.has(u.file) && !live.has(u.id) && owning.has(u.id),
    )
    const dynamicHere = sliceFiles.flatMap((f) => dynamic.get(f))
    const unmeasuredHere = [...new Set(sliceFiles.flatMap((f) => unmeasured.get(f)))].sort()
    result[slice.name] = {
      shape: slice.shape,
      files: { crust: slice.crust.length, internal: sliceFiles.length - slice.crust.length },
      M08: { crust_logic_statements: crustLoc, slice_logic_statements: sliceLoc, share },
      M09: {
        public_surface: surface.length,
        values: surface.filter((s) => s.kind === 'value').length,
        types: surface.filter((s) => s.kind === 'type').length,
        dual: surface.filter((s) => s.kind === 'dual').length,
      },
      M10: {
        crust_complexity: crustCc,
        slice_complexity: sliceCc,
        share: fraction(crustCc, sliceCc),
      },
      M12: { unused_exports: unused.length, names: unused },
      dead_code: {
        excluded_statements: sum(deadInternal, 'statements'),
        excluded_complexity: sum(deadInternal, 'complexity'),
        units: deadUnits.map((u) => `${u.file}#${u.label}`).sort(),
      },
      // 'static' means no listed dynamic form was found; it is not proof of runtime reachability.
      coverage: {
        reachability: dynamicHere.length ? 'partial' : 'static',
        dynamic_access: dynamicHere,
        unmeasured_files: unmeasuredHere,
      },
      module_init: {
        crust: slice.crust.reduce((a, f) => a + moduleInit.get(f), 0),
        slice: sliceFiles.reduce((a, f) => a + moduleInit.get(f), 0),
      },
      advisory: {
        size_aware: crustLoc > SIZE_AWARE.crustLogicStatements && greater(share, SIZE_AWARE.share),
      },
    }
  }
  return result

  function unusedExports(slice, surface) {
    const used = new Set()
    const crust = new Set(slice.crust)
    for (const file of production) {
      if (sliceOf(file) === slice) continue
      const sf = sources.get(file)
      for (const { to, node } of imports.get(file)) {
        if (!crust.has(to)) continue
        const all = () =>
          surface.filter((s) => s.file === to).forEach((s) => used.add(`${to}\0${s.name}`))
        const use = (name) => used.add(`${to}\0${name}`)
        if (ts.isImportDeclaration(node)) {
          const clause = node.importClause
          if (!clause) continue
          if (clause.name && referenced(sf, clause)) use('default')
          const bindings = clause.namedBindings
          if (bindings && ts.isNamedImports(bindings)) {
            for (const el of bindings.elements)
              if (referenced(sf, el)) use((el.propertyName ?? el.name).text)
          } else if (bindings && ts.isNamespaceImport(bindings)) {
            namespaceUses(sf, bindings, use, all)
          }
        } else if (ts.isExportDeclaration(node)) {
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const el of node.exportClause.elements) use((el.propertyName ?? el.name).text)
          } else all()
        } else if (ts.isImportTypeNode(node) && node.qualifier) {
          let head = node.qualifier
          while (ts.isQualifiedName(head)) head = head.left
          use(head.text)
        } else all()
      }
    }
    return surface
      .filter((s) => !used.has(`${s.file}\0${s.name}`))
      .map((s) => `${s.file}#${s.name}`)
  }

  function referencesTo(sf, declaration) {
    const symbol = checker.getSymbolAtLocation(declaration.name)
    const found = []
    const visit = (n) => {
      if (ts.isImportDeclaration(n)) return
      if (ts.isIdentifier(n) && n !== declaration.name && checker.getSymbolAtLocation(n) === symbol)
        found.push(n)
      if (
        ts.isShorthandPropertyAssignment(n) &&
        checker.getShorthandAssignmentValueSymbol(n) === symbol
      )
        found.push(n.name)
      if (ts.isExportSpecifier(n) && checker.getExportSpecifierLocalTargetSymbol(n) === symbol)
        found.push(n.name)
      ts.forEachChild(n, visit)
    }
    visit(sf)
    return found
  }

  function referenced(sf, declaration) {
    return referencesTo(sf, declaration).length > 0
  }

  function namespaceUses(sf, binding, use, all) {
    for (const ref of referencesTo(sf, binding)) {
      const p = ref.parent
      if (ts.isPropertyAccessExpression(p) && p.expression === ref) use(p.name.text)
      else if (ts.isQualifiedName(p) && p.left === ref) use(p.right.text)
      else if (ts.isElementAccessExpression(p) && ts.isStringLiteralLike(p.argumentExpression))
        use(p.argumentExpression.text)
      else all()
    }
  }
}

const DECLARATION_KINDS = new Set([
  K.FunctionDeclaration,
  K.FunctionExpression,
  K.ClassDeclaration,
  K.ClassExpression,
  K.MethodDeclaration,
  K.GetAccessor,
  K.SetAccessor,
  K.VariableDeclaration,
  K.Parameter,
  K.PropertyDeclaration,
  K.PropertyAssignment,
  K.BindingElement,
  K.EnumDeclaration,
  K.EnumMember,
  K.ModuleDeclaration,
])

function isDeclarationName(n) {
  const p = n.parent
  return p !== undefined && DECLARATION_KINDS.has(p.kind) && p.name === n
}

function hasCall(n) {
  let found = false
  const visit = (c) => {
    if (found || isFunctionWithBody(c)) return
    if (
      ts.isCallExpression(c) ||
      ts.isNewExpression(c) ||
      ts.isTaggedTemplateExpression(c) ||
      ts.isAwaitExpression(c)
    )
      found = true
    else ts.forEachChild(c, visit)
  }
  visit(n)
  return found
}
