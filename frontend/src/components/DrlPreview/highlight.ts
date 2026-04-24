export type TokenKind = 'kw' | 'pkg' | 'str' | 'num' | 'cmt' | 'fn' | 'var' | 'op' | 'ws' | 'sym'

export interface Token {
  kind: TokenKind
  text: string
}

const KEYWORDS = new Set([
  'package','import','rule','when','then','end','global','function','declare',
  'dialect','salience','no-loop','lock-on-active','agenda-group','enabled','ruleflow-group',
  'activation-group','duration','auto-focus','date-effective','date-expires','from','collect',
  'accumulate','not','exists','forall','true','false','null','and','or',
])

const RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s])/g

export function tokenize(src: string): Token[] {
  const out: Token[] = []
  let m: RegExpExecArray | null
  RE.lastIndex = 0
  while ((m = RE.exec(src)) !== null) {
    const [full, cmt, str, num, ident, ws, sym] = m
    if (cmt)      out.push({ kind: 'cmt', text: full })
    else if (str) out.push({ kind: 'str', text: full })
    else if (num) out.push({ kind: 'num', text: full })
    else if (ident) {
      if (KEYWORDS.has(full))               out.push({ kind: 'kw', text: full })
      else if (/^[A-Z][\w]*$/.test(full))   out.push({ kind: 'pkg', text: full })
      else if (/^(get|set|has|is|put|check)[A-Z]/.test(full)) out.push({ kind: 'fn', text: full })
      else                                  out.push({ kind: 'var', text: full })
    }
    else if (ws)  out.push({ kind: 'ws', text: full })
    else if (sym) out.push({ kind: /[=!<>+\-*/&|%]/.test(sym) ? 'op' : 'sym', text: sym })
  }
  return out
}
