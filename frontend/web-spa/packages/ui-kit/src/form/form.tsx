import { useId, type FormHTMLAttributes, type ReactNode } from "react";
import {
  FormProvider,
  useForm,
  useFormContext,
  type FieldErrors,
  type FieldValues,
  type Resolver,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormProps,
  type UseFormRegisterReturn,
  type UseFormReturn,
  type UseFormSetError,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { cn } from "../lib/utils";
import { Label } from "../primitives/label";
import { Heading, Text } from "../components/typography";
import type { ApiErrorFields } from "../api/client";

type SchemaValues<S extends z.ZodTypeAny> =
  z.infer<S> extends FieldValues ? z.infer<S> : FieldValues;

/** `useForm` preconfigured with a zod resolver. */
export function useZodForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  options?: Omit<UseFormProps<SchemaValues<TSchema>>, "resolver">,
): UseFormReturn<SchemaValues<TSchema>> {
  return useForm<SchemaValues<TSchema>>({
    ...options,
    resolver: zodResolver(schema as never) as unknown as Resolver<SchemaValues<TSchema>>,
  });
}

export function Form<TValues extends FieldValues>({
  form,
  onSubmit,
  onInvalid,
  children,
  className,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "children"> & {
  form: UseFormReturn<TValues>;
  onSubmit: SubmitHandler<TValues>;
  onInvalid?: SubmitErrorHandler<TValues>;
  children: ReactNode;
}) {
  return (
    <FormProvider {...form}>
      <form
        noValidate
        className={cn("space-y-6", className)}
        onSubmit={(event) => void form.handleSubmit(onSubmit, onInvalid)(event)}
        {...props}
      >
        {children}
      </form>
    </FormProvider>
  );
}

export type FormFieldRenderProps = {
  id: string;
  name: string;
  invalid: boolean;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
  /** Result of `register(name)` for uncontrolled inputs. */
  field: UseFormRegisterReturn;
};

function getFieldError(errors: FieldErrors, name: string): string | undefined {
  let current: unknown = errors;
  for (const segment of name.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  if (typeof current === "object" && current !== null && "message" in current) {
    const message = (current as { message?: unknown }).message;
    return typeof message === "string" && message ? message : undefined;
  }
  return undefined;
}

export function FormField({
  name,
  label,
  description,
  required,
  children,
  className,
}: {
  name: string;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  /** Either static content (e.g. a `Controller`) or a render prop with a11y props + `register`. */
  children: ReactNode | ((props: FormFieldRenderProps) => ReactNode);
  className?: string;
}) {
  const { register, formState } = useFormContext();
  const reactId = useId();
  const id = `${reactId}-${name}`;
  const error = getFieldError(formState.errors, name);
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
      ) : null}
      {typeof children === "function"
        ? children({
            id,
            name,
            invalid: Boolean(error),
            "aria-invalid": Boolean(error),
            "aria-describedby": describedBy,
            field: register(name),
          })
        : children}
      {description ? (
        <Text variant="muted" id={descriptionId}>
          {description}
        </Text>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-muted text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-4", className)}>
      {title || description ? (
        <div className="space-y-1">
          {title ? <Heading level={3}>{title}</Heading> : null}
          {description ? <Text variant="muted">{description}</Text> : null}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 pt-2", className)}>
      {children}
    </div>
  );
}

/**
 * Apply `ApiError.fields` to react-hook-form. Returns the list of field names
 * that were set so callers can fall back to a toast when nothing matched.
 */
export function mapServerErrors<TValues extends FieldValues>(
  fields: ApiErrorFields | undefined,
  setError: UseFormSetError<TValues>,
): string[] {
  if (!fields) return [];
  const applied: string[] = [];
  for (const [name, messages] of Object.entries(fields)) {
    if (messages.length === 0) continue;
    setError(name as Parameters<UseFormSetError<TValues>>[0], {
      type: "server",
      message: messages.join(" "),
    });
    applied.push(name);
  }
  return applied;
}
