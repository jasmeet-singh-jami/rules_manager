interface SkeletonProps { width?: number | string; height?: number; className?: string }

export function Skeleton({ width = '100%', height = 13, className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`.trim()} style={{ width, height }} />
}

interface SkeletonRowsProps { count?: number; cols?: number }

export function SkeletonRows({ count = 5, cols = 6 }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><Skeleton width={c === 0 ? 40 : c === 1 ? '60%' : '80%'} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}
