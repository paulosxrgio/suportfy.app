import { ChevronDown } from "lucide-react";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-md border border-line-strong bg-surface text-sm text-ink transition-colors placeholder:text-ink-4 hover:border-ink-4 focus:border-primary-500 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-200 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3 aria-invalid:border-danger-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, "h-9 px-3", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(controlBase, "min-h-20 px-3 py-2 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }>(
  function Select({ className, wrapperClassName, children, ...props }, ref) {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <select ref={ref} className={cn(controlBase, "h-9 appearance-none pr-8 pl-3", className)} {...props}>
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
      </div>
    );
  },
);

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-[13px] font-medium text-ink", className)}>
      {children}
    </label>
  );
}

interface FieldProps {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}

/** Rótulo, descrição e erro ligados ao controle por id/aria-describedby. */
export function Field({ label, description, error, optional, className, children }: FieldProps) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="ml-1 font-normal text-ink-3">(opcional)</span>}
      </Label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {description && (
        <p id={descId} className="text-xs text-ink-3">
          {description}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
