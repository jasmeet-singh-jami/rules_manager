// ── AST types ──────────────────────────────────────────────────────────────

export type LiteralKind = 'string' | 'number' | 'bool' | 'regex' | 'ident'

export interface LiteralNode { kind: LiteralKind; value: string }
export interface FieldRef { path: string[] }
export interface BindingArg { kind: 'binding' }
export type FnCallArg = FieldRef | LiteralNode | BindingArg
export interface FnCall { name: string; args: FnCallArg[] }
export type Operand = FieldRef | LiteralNode | FnCall

export interface CmpNode { kind: 'cmp'; op: string; left: Operand; right: Operand }
export interface GroupNode {
  kind: 'group'
  combinator: 'and' | 'or'
  children: AstNode[]
  // implicit groups are precedence wrappers (auto-generated when mixing AND/OR)
  // and flatten back into their parent level on display. Explicit groups
  // (created by the user via "+ Group") are opaque and rendered as nested.
  implicit?: boolean
}
export interface RawNode { kind: 'raw'; text: string }
export type AstNode = CmpNode | GroupNode | RawNode

export type BindingStyle =
  | { style: 'alias'; alias: string; fact_type: string }
  | { style: 'dollar'; var: string; fact_type: string }

export interface ConditionMeta {
  schema_version: 1
  mode: 'builder' | 'raw'
  template_key: string
  bindings: BindingStyle[]
  expression: AstNode | null
}

// ── Builder config (comes from rule_type.builder_config) ────────────────────

export interface BuilderField {
  name: string
  label: string
  type: 'string' | 'number' | 'enum'
  enum?: string[]
  allowed_ops: string[]
}

export interface HelperFunctionArg { kind: 'binding' | 'literal' }

export interface HelperFunction {
  name: string
  args: HelperFunctionArg[]
  return_type: 'number' | 'string' | 'bool'
}

export interface BuilderConfig {
  binding: BindingStyle
  field_path_prefix: string[]
  fields: BuilderField[]
  helper_functions: HelperFunction[]
  allow_groups: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function isFieldRef(op: Operand): op is FieldRef {
  return 'path' in op
}
export function isFnCall(op: Operand): op is FnCall {
  return 'name' in op && 'args' in op
}
export function isLiteral(op: Operand): op is LiteralNode {
  return 'kind' in op && 'value' in op
}

export function newCmpNode(config: BuilderConfig): CmpNode {
  const f = config.fields[0]
  return {
    kind: 'cmp',
    op: f?.allowed_ops[0] ?? '==',
    left: { path: [f?.name ?? ''] },
    right: f?.type === 'enum'
      ? { kind: 'string', value: f.enum?.[0] ?? '' }
      : { kind: 'string', value: '' },
  }
}

export function newExplicitGroup(config: BuilderConfig, combinator: 'and' | 'or' = 'and'): GroupNode {
  return { kind: 'group', combinator, children: [newCmpNode(config), newCmpNode(config)] }
}

export function emptyConditionMeta(config: BuilderConfig, templateKey: string): ConditionMeta {
  const firstField = config.fields[0]
  return {
    schema_version: 1,
    mode: 'builder',
    template_key: templateKey,
    bindings: [config.binding],
    expression: firstField ? newCmpNode(config) : null,
  }
}

// ── Flat-level conversion ──────────────────────────────────────────────────
//
// The Builder UI shows each level as a flat sequence of items joined by
// per-pair AND/OR pills. Internally the AST nests AND-chunks under OR-groups
// (AND > OR precedence). flattenToLevel produces the visual form;
// levelToAst reconstructs the canonical AST.

export interface FlatLevel {
  items: AstNode[]
  joins: ('and' | 'or')[] // joins[i] joins items[i] and items[i+1]
}

function flattenAndChunk(n: AstNode): AstNode[] {
  if (n.kind === 'group' && n.implicit && n.combinator === 'and') {
    return n.children.flatMap(flattenAndChunk)
  }
  return [n]
}

export function flattenToLevel(node: AstNode): FlatLevel {
  if (node.kind !== 'group') {
    return { items: [node], joins: [] }
  }
  if (node.combinator === 'and') {
    const items = node.children.flatMap(flattenAndChunk)
    return { items, joins: items.slice(1).map(() => 'and' as const) }
  }
  // OR-group: each child is an OR-chunk; inline AND-chunks within
  const items: AstNode[] = []
  const joins: ('and' | 'or')[] = []
  for (let i = 0; i < node.children.length; i++) {
    const chunk = flattenAndChunk(node.children[i])
    for (let j = 0; j < chunk.length; j++) {
      if (items.length > 0) joins.push(j === 0 ? 'or' : 'and')
      items.push(chunk[j])
    }
  }
  return { items, joins }
}

export function levelToAst(level: FlatLevel): AstNode {
  if (level.items.length === 0) {
    return { kind: 'group', combinator: 'and', children: [], implicit: true }
  }
  if (level.items.length === 1) return level.items[0]

  // Split on OR; each chunk is AND-bound.
  const orChunks: AstNode[][] = [[level.items[0]]]
  for (let i = 0; i < level.joins.length; i++) {
    if (level.joins[i] === 'and') {
      orChunks[orChunks.length - 1].push(level.items[i + 1])
    } else {
      orChunks.push([level.items[i + 1]])
    }
  }
  const orChildren: AstNode[] = orChunks.map(chunk =>
    chunk.length === 1
      ? chunk[0]
      : { kind: 'group', combinator: 'and', children: chunk, implicit: true },
  )
  if (orChildren.length === 1) return orChildren[0]
  return { kind: 'group', combinator: 'or', children: orChildren, implicit: true }
}

// ── Renderer ─────────────────────────────────────────────────────────────────

type RenderableOperand = Operand | BindingArg

function renderOperand(operand: RenderableOperand, prefixStr: string): string {
  if ('path' in operand) {
    const { path } = operand as FieldRef
    if (path.length === 0) return prefixStr
    return prefixStr ? `${prefixStr}.${path.join('.')}` : path.join('.')
  }
  // BindingArg: has kind='binding' but no value/name/path
  if (!('value' in operand) && !('name' in operand)) {
    return prefixStr
  }
  if ('name' in operand) {
    const fn = operand as FnCall
    const argsStr = fn.args.map(a => renderOperand(a as RenderableOperand, prefixStr)).join(', ')
    return `${fn.name}(${argsStr})`
  }
  const lit = operand as LiteralNode
  if (lit.kind === 'string' || lit.kind === 'regex') return `"${lit.value}"`
  return lit.value
}

function renderNode(node: AstNode, prefixStr: string, isTop = false): string {
  if (node.kind === 'raw') return node.text
  if (node.kind === 'cmp') {
    return `${renderOperand(node.left, prefixStr)} ${node.op} ${renderOperand(node.right, prefixStr)}`
  }
  // group
  const sep = node.combinator === 'and' ? ' && ' : ' || '
  const parts = node.children.map(c => renderNode(c, prefixStr, false))
  const inner = parts.join(sep)
  return !isTop && node.combinator === 'or' && parts.length > 1 ? `(${inner})` : inner
}

export function renderCondition(meta: ConditionMeta, config: BuilderConfig): string {
  if (!meta.bindings.length || meta.expression === null) return ''
  const prefixStr = config.field_path_prefix.join('.')
  const binding = meta.bindings[0]
  const inner = renderNode(meta.expression, prefixStr, true)
  if (binding.style === 'alias') return `${binding.alias}:${binding.fact_type}(${inner})`
  return `$${binding.var} : ${binding.fact_type}(${inner})`
}

// ── Parser ───────────────────────────────────────────────────────────────────

const TT = {
  NUM: 'NUM', STR: 'STR', IDENT: 'IDENT', DOT: 'DOT',
  OP: 'OP', AND: 'AND', OR: 'OR',
  LPAREN: 'LPAREN', RPAREN: 'RPAREN', COMMA: 'COMMA', EOF: 'EOF',
} as const
type TType = (typeof TT)[keyof typeof TT]
type Token = [TType, string]

function tokenize(text: string): Token[] {
  const toks: Token[] = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (/\s/.test(c)) { i++; continue }

    // String literal
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') { if (text[j] === '\\') j++; j++ }
      toks.push([TT.STR, text.slice(i, j + 1)]); i = j + 1; continue
    }

    const two = text.slice(i, i + 2)
    if (two === '&&') { toks.push([TT.AND, '&&']); i += 2; continue }
    if (two === '||') { toks.push([TT.OR, '||']); i += 2; continue }
    if (['==', '!=', '<=', '>='].includes(two)) { toks.push([TT.OP, two]); i += 2; continue }
    if (c === '<' || c === '>') { toks.push([TT.OP, c]); i++; continue }
    if (c === '(') { toks.push([TT.LPAREN, c]); i++; continue }
    if (c === ')') { toks.push([TT.RPAREN, c]); i++; continue }
    if (c === '.') { toks.push([TT.DOT, c]); i++; continue }
    if (c === ',') { toks.push([TT.COMMA, c]); i++; continue }

    const numM = text.slice(i).match(/^-?\d+(?:\.\d+)?/)
    if (numM) { toks.push([TT.NUM, numM[0]]); i += numM[0].length; continue }

    const idM = text.slice(i).match(/^[A-Za-z_]\w*/)
    if (idM) {
      const word = idM[0]; i += word.length
      if (word === 'not') {
        const rest = text.slice(i).replace(/^\s+/, '')
        if (rest.startsWith('matches')) {
          i += text.slice(i).indexOf('m') + 'matches'.length
          toks.push([TT.OP, 'not matches']); continue
        }
        if (rest.startsWith('contains')) {
          i += text.slice(i).indexOf('c') + 'contains'.length
          toks.push([TT.OP, 'not contains']); continue
        }
      }
      toks.push([TT.IDENT, word]); continue
    }
    i++
  }
  toks.push([TT.EOF, ''])
  return toks
}

class Parser {
  private pos = 0
  constructor(private toks: Token[], private prefix: string[]) {}

  private peek(): Token { return this.toks[this.pos] }
  private peekType(): TType { return this.toks[this.pos][0] }
  private advance(): Token { return this.toks[this.pos++] }
  private expect(tt: TType): Token {
    const t = this.advance()
    if (t[0] !== tt) throw new Error(`expected ${tt} got ${t[0]} (${t[1]})`)
    return t
  }

  parse(): AstNode {
    const node = this.parseAnd()
    if (this.peekType() !== TT.EOF) throw new Error(`unexpected token: ${this.peek()[1]}`)
    return node
  }

  private parseAnd(): AstNode {
    const children: AstNode[] = [this.parseOr()]
    while (this.peekType() === TT.AND) {
      this.advance(); children.push(this.parseOr())
    }
    return children.length === 1 ? children[0] : { kind: 'group', combinator: 'and', children, implicit: true }
  }

  private parseOr(): AstNode {
    const children: AstNode[] = [this.parseAtom()]
    while (this.peekType() === TT.OR) {
      this.advance(); children.push(this.parseAtom())
    }
    return children.length === 1 ? children[0] : { kind: 'group', combinator: 'or', children, implicit: true }
  }

  private parseAtom(): AstNode {
    if (this.peekType() === TT.LPAREN) {
      this.advance()
      const node = this.parseAnd()
      this.expect(TT.RPAREN)
      return node
    }
    return this.parseComparison()
  }

  private isCmpOp(): boolean {
    const [tt, tv] = this.peek()
    return tt === TT.OP || (tt === TT.IDENT && (tv === 'matches' || tv === 'contains'))
  }

  private parseComparison(): AstNode {
    const left = this.parseOperand()
    if (!this.isCmpOp()) throw new Error(`expected comparison operator`)
    const op = this.advance()[1]
    let right = this.parseOperand()
    if ((op === 'matches' || op === 'not matches') && isLiteral(right as Operand) && (right as LiteralNode).kind === 'string') {
      right = { ...(right as LiteralNode), kind: 'regex' }
    }
    return { kind: 'cmp', op, left: left as Operand, right: right as Operand }
  }

  private parseOperand(): AstNode | Operand {
    const [tt, tv] = this.peek()
    if (tt === TT.STR) { this.advance(); return { kind: 'string', value: tv.slice(1, -1) } }
    if (tt === TT.NUM) { this.advance(); return { kind: 'number', value: tv } }
    if (tt === TT.IDENT) {
      if (tv === 'true' || tv === 'false') { this.advance(); return { kind: 'bool', value: tv } }
      if (tv === 'null') { this.advance(); return { kind: 'ident', value: 'null' } }

      const parts = [tv]; this.advance()
      while (this.peekType() === TT.DOT) {
        this.advance()
        if (this.peekType() === TT.IDENT) parts.push(this.advance()[1])
      }
      if (this.peekType() === TT.LPAREN) {
        this.advance()
        const args: FnCallArg[] = []
        if (this.peekType() !== TT.RPAREN) {
          args.push(this.parseFnArg())
          while (this.peekType() === TT.COMMA) { this.advance(); args.push(this.parseFnArg()) }
        }
        this.expect(TT.RPAREN)
        return { name: parts[parts.length - 1], args }
      }
      return this.makeFieldRef(parts)
    }
    throw new Error(`unexpected token in operand: ${tv}`)
  }

  private parseFnArg(): FnCallArg {
    const arg = this.parseOperand()
    if ('path' in arg && (arg as FieldRef).path.length === 0 && this.prefix.length > 0) {
      return { kind: 'binding' }
    }
    return arg as unknown as FnCallArg
  }

  private makeFieldRef(parts: string[]): FieldRef {
    const p = this.prefix
    if (p.length && JSON.stringify(parts.slice(0, p.length)) === JSON.stringify(p)) {
      return { path: parts.slice(p.length) }
    }
    return { path: parts }
  }
}

function findMatchingParen(text: string, start: number): number {
  let depth = 0, inStr = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '"' && !inStr) inStr = true
    else if (c === '"' && inStr) inStr = false
    else if (!inStr) {
      if (c === '(') depth++
      else if (c === ')') { depth--; if (depth === 0) return i }
    }
  }
  return -1
}

function extractBinding(raw: string): { binding: BindingStyle; inner: string } | null {
  const text = raw.trim()

  const dollarM = text.match(/^\$(\w+)\s*:\s*(\w+)\s*\(/)
  if (dollarM) {
    const start = dollarM[0].length - 1
    const end = findMatchingParen(text, start)
    if (end === text.length - 1) {
      return {
        binding: { style: 'dollar', var: dollarM[1], fact_type: dollarM[2] },
        inner: text.slice(start + 1, end),
      }
    }
  }

  const aliasM = text.match(/^(\w+):(\w+)\s*\(/)
  if (aliasM) {
    const start = aliasM[0].length - 1
    const end = findMatchingParen(text, start)
    if (end === text.length - 1) {
      return {
        binding: { style: 'alias', alias: aliasM[1], fact_type: aliasM[2] },
        inner: text.slice(start + 1, end),
      }
    }
  }
  return null
}

function hasRaw(node: AstNode): boolean {
  if (node.kind === 'raw') return true
  if (node.kind === 'group') return node.children.some(hasRaw)
  return false
}

export function parseCondition(
  conditionRaw: string,
  config: BuilderConfig,
  templateKey: string,
): { meta: ConditionMeta; confidence: number } {
  const extracted = extractBinding(conditionRaw.trim())
  if (!extracted) {
    return {
      meta: {
        schema_version: 1, mode: 'builder', template_key: templateKey,
        bindings: [], expression: { kind: 'raw', text: conditionRaw.trim() },
      },
      confidence: 0,
    }
  }
  const { binding, inner } = extracted
  let expression: AstNode
  try {
    const toks = tokenize(inner)
    const parser = new Parser(toks, config.field_path_prefix)
    expression = parser.parse()
  } catch {
    return {
      meta: {
        schema_version: 1, mode: 'builder', template_key: templateKey,
        bindings: [binding], expression: { kind: 'raw', text: inner },
      },
      confidence: 0.5,
    }
  }
  return {
    meta: {
      schema_version: 1, mode: 'builder', template_key: templateKey,
      bindings: [binding], expression,
    },
    confidence: hasRaw(expression) ? 0.5 : 1,
  }
}

export function normalizeCondition(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/ *(==|!=|<=|>=|<|>|&&|\|\|) */g, '$1')
}
