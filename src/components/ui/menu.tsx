"use client";

import { DropdownMenu as Menu, Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;

const panel =
  "z-50 min-w-44 overflow-hidden rounded-xl bg-surface p-1 text-sm text-ink shadow-popover data-[state=open]:animate-pop-in";

export function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(panel, "max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto", className)}
        {...props}
      />
    </Menu.Portal>
  );
}

const itemBase =
  "relative flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-4 data-[highlighted]:bg-subtle [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3";

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return <Menu.Item className={cn(itemBase, danger && "text-danger-700 [&_svg]:text-danger-700", className)} {...props} />;
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: ComponentProps<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem className={cn(itemBase, "pl-8", className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center rounded border border-line-strong bg-surface data-[state=checked]:border-primary-600">
        <Menu.ItemIndicator>
          <Check className="size-3! text-primary-700!" strokeWidth={3} />
        </Menu.ItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

export function DropdownMenuRadioGroup(props: ComponentProps<typeof Menu.RadioGroup>) {
  return <Menu.RadioGroup {...props} />;
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(itemBase, "pl-8", className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <Menu.ItemIndicator>
          <Check className="text-primary-700!" strokeWidth={2.5} />
        </Menu.ItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-2 pt-2 pb-1 text-[11.5px] font-medium tracking-wide text-ink-3 uppercase", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
}

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(panel, "p-0 focus:outline-none", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="z-[60] max-w-64 rounded-md bg-ink px-2 py-1 text-xs leading-snug text-white shadow-popover data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
