import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerClassName = '',
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          autoComplete="off"
          {...props}
          className={`
            w-full rounded-xl border px-4 py-2.5 text-sm
            bg-white dark:bg-gray-700
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            disabled:opacity-60 disabled:cursor-not-allowed
            ${error
              ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            ${className}
          `}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export function Textarea({
  label,
  error,
  hint,
  containerClassName = '',
  className = '',
  id,
  ...props
}: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        className={`
          w-full rounded-xl border px-4 py-2.5 text-sm
          bg-white dark:bg-gray-700
          text-gray-900 dark:text-white
          placeholder-gray-400 dark:placeholder-gray-500
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          disabled:opacity-60 disabled:cursor-not-allowed resize-none
          ${error
            ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${className}
        `}
      />
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  error,
  hint,
  containerClassName = '',
  className = '',
  options,
  id,
  ...props
}: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={inputId}
        {...props}
        className={`
          w-full rounded-xl border px-4 py-2.5 text-sm
          bg-white dark:bg-gray-700
          text-gray-900 dark:text-white
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          disabled:opacity-60 disabled:cursor-not-allowed
          ${error
            ? 'border-red-400 dark:border-red-500'
            : 'border-gray-300 dark:border-gray-600'
          }
          ${className}
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}
