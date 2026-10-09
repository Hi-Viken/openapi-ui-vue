/**
 * 变量引用（{{{name}}}）的可读描述，供 VariableInput 的预览气泡与 CodeEditor 的悬停提示共用。
 * 抽出一份，避免两处各自翻译、文案漂移。
 */
export function referenceDescription(
  ref: any,
  t: (key: string, params?: Record<string, any>) => string
): string {
  const heading = `${ref.output ? t('ui.outputVariable') : t('ui.variable')}: {{${ref.name}}}`
  const details =
    ref.status === 'resolved'
      ? `${t('ui.value')} ${ref.value === '' ? t('ui.emptyString') : ref.value}`
      : ref.status === 'pending'
        ? t('ui.pendingOutput')
        : ref.output
          ? t('ui.missingOutput')
          : t('ui.missingVariable')
  return [heading, ...(ref.paths || []).map((path: string) => `JSONPath: ${path}`), details].join('\n\n')
}
