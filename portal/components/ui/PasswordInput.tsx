"use client";

import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { fieldClasses } from "./Input";

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
};

export function PasswordInput({
  label,
  helper,
  error,
  optional,
  className = "",
  id,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

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
      <div className="relative">
        <input
          {...rest}
          id={id}
          type={visible ? "text" : "password"}
          className={fieldClasses(`pr-10 ${className}`)}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-text-light hover:text-gold transition-colors"
          tabIndex={-1}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : helper ? (
        <p className="text-xs text-text-light">{helper}</p>
      ) : null}
    </div>
  );
}
