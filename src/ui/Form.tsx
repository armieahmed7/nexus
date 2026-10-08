/**
 * Validated form fields. Validation is declarative and runs on submit and on blur.
 *   const form = useForm({ email: '', topic: '' }, { email: [required(), email()], topic: [required()] });
 *   <form onSubmit={form.handleSubmit(async (v) => ...)}>
 *     <TextField label=".." {...form.field('email')} />
 *   </form>
 * Validator messages are i18n keys (common.validation.*) so they render in the current language.
 */
import { useCallback, useId, useState, type FormEvent, type ReactNode } from 'react';
import { useT } from '../i18n';

export type Validator = (v: string, all: Record<string, string>) => string | null; // returns an i18n key or null
export const required = (): Validator => (v) => (v.trim() ? null : 'common.validation.required');
export const email = (): Validator => (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'common.validation.email');
export const minLen = (n: number): Validator => (v) => (!v || v.trim().length >= n ? null : `common.validation.minLen:${n}`);
export const maxLen = (n: number): Validator => (v) => (v.length <= n ? null : `common.validation.maxLen:${n}`);
export const pattern = (re: RegExp, key = 'common.validation.format'): Validator => (v) => (!v || re.test(v) ? null : key);
export const numberRange = (min: number, max: number): Validator => (v) => (!v || (Number(v) >= min && Number(v) <= max) ? null : `common.validation.range:${min}:${max}`);

export function useForm<T extends Record<string, string>>(initial: T, rules: Partial<Record<keyof T, Validator[]>> = {}) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const validateOne = useCallback(
    (k: keyof T, all: T) => {
      for (const r of rules[k] ?? []) {
        const e = r(all[k] ?? '', all);
        if (e) return e;
      }
      return null;
    },
    [rules],
  );
  const validate = useCallback(() => {
    const next: Partial<Record<keyof T, string>> = {};
    for (const k of Object.keys(values) as (keyof T)[]) {
      const e = validateOne(k, values);
      if (e) next[k] = e;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [values, validateOne]);
  const field = (k: keyof T) => ({
    name: String(k),
    value: values[k] ?? '',
    error: errors[k] ?? null,
    onChange: (v: string) => setValues((cur) => ({ ...cur, [k]: v })),
    onBlur: () => setErrors((cur) => ({ ...cur, [k]: validateOne(k, values) ?? undefined })),
  });
  const handleSubmit = (fn: (v: T) => Promise<unknown> | unknown) => async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await fn(values);
    } finally {
      setSubmitting(false);
    }
  };
  return { values, setValues, errors, field, validate, handleSubmit, submitting, reset: () => setValues(initial) };
}

function useErr(error: string | null | undefined) {
  const t = useT();
  if (!error) return null;
  const [key, ...args] = error.split(':');
  return t(key, { n: args[0] ?? '', min: args[0] ?? '', max: args[1] ?? '' });
}

interface BaseProps {
  label: ReactNode;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  disabled?: boolean;
}
function FieldShell({ id, label, hint, error, required: req, children }: { id: string; label: ReactNode; hint?: ReactNode; error: string | null; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
        {req && <span className="text-bad"> *</span>}
      </label>
      {children}
      {hint && !error && <span id={`${id}-hint`} className="text-[12px] text-ink-3">{hint}</span>}
      {error && (
        <span id={`${id}-err`} className="text-[12px] text-bad" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({ type = 'text', placeholder, autoComplete, ...p }: BaseProps & { type?: string; placeholder?: string; autoComplete?: string }) {
  const id = useId();
  const err = useErr(p.error);
  return (
    <FieldShell id={id} label={p.label} hint={p.hint} error={err} required={p.required}>
      <input id={id} name={p.name} type={type} className="input" value={p.value} placeholder={placeholder} autoComplete={autoComplete} disabled={p.disabled} onChange={(e) => p.onChange(e.target.value)} onBlur={p.onBlur} aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-err` : p.hint ? `${id}-hint` : undefined} />
    </FieldShell>
  );
}
export function TextArea({ rows = 4, ...p }: BaseProps & { rows?: number }) {
  const id = useId();
  const err = useErr(p.error);
  return (
    <FieldShell id={id} label={p.label} hint={p.hint} error={err} required={p.required}>
      <textarea id={id} name={p.name} rows={rows} className="input" value={p.value} disabled={p.disabled} onChange={(e) => p.onChange(e.target.value)} onBlur={p.onBlur} aria-invalid={err ? true : undefined} />
    </FieldShell>
  );
}
export function SelectField({ options, placeholder, ...p }: BaseProps & { options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  const err = useErr(p.error);
  const t = useT();
  return (
    <FieldShell id={id} label={p.label} hint={p.hint} error={err} required={p.required}>
      <select id={id} name={p.name} className="input" value={p.value} disabled={p.disabled} onChange={(e) => p.onChange(e.target.value)} onBlur={p.onBlur} aria-invalid={err ? true : undefined}>
        <option value="">{placeholder ?? t('common.choose')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
export function CheckboxField({ label, checked, onChange, hint, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="text-[13.5px]">
        {label}
        {hint && <span className="block text-[12px] text-ink-3">{hint}</span>}
      </label>
    </div>
  );
}
export function RadioGroup({ label, name, value, onChange, options }: { label: ReactNode; name: string; value: string; onChange: (v: string) => void; options: { value: string; label: ReactNode }[] }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-[13px] font-semibold">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2 text-[13.5px]">
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="accent-[rgb(var(--accent))]" />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
