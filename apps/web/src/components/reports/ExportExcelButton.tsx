import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportExcelButtonProps {
  disabled?: boolean
  loading?: boolean
  onClick: () => void | Promise<void>
  label?: string
  className?: string
}

export function ExportExcelButton({
  disabled,
  loading,
  onClick,
  label = 'Descargar Excel',
  className,
}: ExportExcelButtonProps) {
  return (
    <Button
      variant="secondary"
      loading={loading}
      disabled={disabled || loading}
      onClick={() => void onClick()}
      className={className ?? 'bg-surface-container-high text-on-surface hover:bg-surface-container-higher'}
    >
      <Download className="size-4" />
      {label}
    </Button>
  )
}
