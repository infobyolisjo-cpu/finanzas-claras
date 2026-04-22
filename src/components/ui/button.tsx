import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-[12px] font-medium tracking-btn uppercase transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        /* Botón primario: fondo oscuro — uso general */
        default:
          "bg-bj-sidebar text-bj-text-on-dark hover:bg-bj-sidebar/90 rounded-sm",
        /* Botón de marca: CTA principal — máximo uno por pantalla */
        brand:
          "bg-bj-brand text-bj-text-on-dark hover:bg-bj-brand-hover rounded-sm",
        /* Botón destructivo */
        destructive:
          "bg-bj-negative text-bj-text-on-dark hover:bg-bj-negative/90 rounded-sm",
        /* Botón secundario: contorno */
        outline:
          "border border-bj-text-primary bg-transparent text-bj-text-primary hover:bg-bj-hover rounded-sm",
        /* Botón suave: fondo tenue */
        secondary:
          "bg-bj-row-alt text-bj-text-primary hover:bg-bj-hover rounded-sm",
        /* Ghost */
        ghost:
          "bg-transparent text-bj-text-primary hover:bg-bj-hover rounded-sm",
        /* Link */
        link:
          "text-bj-brand underline-offset-4 hover:underline normal-case tracking-normal",
      },
      size: {
        default: "h-10 px-7 py-2",
        sm:      "h-8 px-4 py-1.5",
        lg:      "h-12 px-9 py-3 text-[13px]",
        icon:    "h-9 w-9 uppercase-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
