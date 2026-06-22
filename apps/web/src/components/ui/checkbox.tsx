import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function Checkbox({
  className,
  children,
  checked,
  ...props
}: CheckboxPrimitive.Root.Props & { children?: React.ReactNode }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox inline-flex items-center gap-3 outline-none",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[6px] border bg-background transition-all duration-200 group-focus-visible/checkbox:ring-3 group-focus-visible/checkbox:ring-ring/50",
          checked
            ? "border-primary-container bg-primary-container text-white shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]"
            : "border-input text-transparent hover:border-primary/40"
        )}
      >
        <CheckboxPrimitive.Indicator
          render={<CheckIcon className="size-3.5" />}
        />
      </span>
      {children ? <span className="min-w-0 flex-1">{children}</span> : null}
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
