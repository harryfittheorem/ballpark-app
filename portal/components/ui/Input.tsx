import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const FIELD_BASE =
  "block w-full rounded-xl border border-border-gold bg-darkest/80 px-3.5 py-2.5 text-sm text-cream-light placeholder:text-text-light/60 shadow-inner transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50";

export function fieldClasses(extra = "") {
  return `${FIELD_BASE} ${extra}`.trim();
}

function Wrapper({
  id,
  label,
  helper,
  error,
  optional,
  children,
}: {
  id?: string;
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={id}
          className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
        >
          <span>{label}</span>
          {optional ? (
            <span className="text-[10px] font-normal normal-case tracking-normal text-text-light">
              optional
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : helper ? (
        <p className="text-xs text-text-light">{helper}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
};

export function Input({
  label,
  helper,
  error,
  optional,
  className = "",
  ...rest
}: InputProps) {
  return (
    <Wrapper
      id={rest.id}
      label={label}
      helper={helper}
      error={error}
      optional={optional}
    >
      <input {...rest} className={fieldClasses(className)} />
    </Wrapper>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
};

export function TextArea({
  label,
  helper,
  error,
  optional,
  className = "",
  ...rest
}: TextAreaProps) {
  return (
    <Wrapper
      id={rest.id}
      label={label}
      helper={helper}
      error={error}
      optional={optional}
    >
      <textarea {...rest} className={fieldClasses(className)} />
    </Wrapper>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
};

export function Select({
  label,
  helper,
  error,
  optional,
  className = "",
  children,
  ...rest
}: SelectProps) {
  return (
    <Wrapper
      id={rest.id}
      label={label}
      helper={helper}
      error={error}
      optional={optional}
    >
      <select {...rest} className={fieldClasses(className)}>
        {children}
      </select>
    </Wrapper>
  );
}
