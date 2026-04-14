import { Rule, RuleType, Client } from '../../api/client'

interface Props {
  rule: Partial<Rule> | null
  ruleTypes: RuleType[]
  clients: Client[]
  defaultClientId?: string
  defaultRuleTypeId?: string
  onSave: (rule: Rule) => void
  onClose: () => void
}

export function RuleEditor(_props: Props) {
  return <p>RuleEditor stub</p>
}
