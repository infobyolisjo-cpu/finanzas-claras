import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium tracking-[0.04em] uppercase transition-colors",
  {
    variants: {
      variant: {
        /* Estado positivo: ingreso, ganancia */
        positive:
          "border-transparent bg-bj-positive/10 text-bj-positive",
        /* Estado negativo: gasto, pérdida */
        negative:
          "border-transparent bg-bj-negative/10 text-bj-negative",
        /* Advertencia */
        warning:
          "border-transparent bg-bj-warning/10 text-bj-warning",
        /* Marca / premium */
        brand:
          "border-transparent bg-bj-brand/12 text-bj-brand",
        /* Neutro */
        default:
          "border-transparent bg-bj-row-alt text-bj-text-secondary",
        /* Contorno */
        outline:
          "border-border text-foreground",
        /* Para compatibilidad con shadcn existente */
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-bj-negative/10 text-bj-negative",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
