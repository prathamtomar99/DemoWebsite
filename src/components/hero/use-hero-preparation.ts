import { useCallback, useState } from 'react'
import type { PreparationProgress } from './full-frame-policy'

export function useHeroPreparation(staticMode: boolean) {
  const [prepared, setPrepared] = useState<PreparationProgress>({ downloaded: 0, decoded: 0, total: 0, ready: false })
  const report = useCallback((value: PreparationProgress) => setPrepared(value), [])
  return { preparing: !staticMode && !prepared.ready, prepared, report }
}
