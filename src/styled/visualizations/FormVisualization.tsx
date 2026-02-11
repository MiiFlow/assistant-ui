import { useState } from "react";
import { cn } from "../../utils/cn";
import type { FormVisualizationData, FormField, VisualizationConfig } from "../../types";

export interface FormVisualizationProps {
  data: FormVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
}

export function FormVisualization({ data, config, isStreaming = false }: FormVisualizationProps) {
  const { fields, submitAction } = data;
  const submitButtonText = config?.submitButtonText || "Submit";
  const cancelButtonText = config?.cancelButtonText || "Cancel";

  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    fields.forEach((field) => {
      if (field.defaultValue !== undefined) initial[field.name] = field.defaultValue;
      else if (field.type === "multiselect") initial[field.name] = [];
      else if (field.type === "checkbox") initial[field.name] = false;
      else initial[field.name] = "";
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const value = formData[field.name];
      if (field.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))) {
        newErrors[field.name] = `${field.label} is required`;
        return;
      }
      if (!value && !field.required) return;
      if (field.validation) {
        const { min, max, pattern, message } = field.validation;
        if (min !== undefined && typeof value === "number" && value < min) newErrors[field.name] = message || `Minimum value is ${min}`;
        if (max !== undefined && typeof value === "number" && value > max) newErrors[field.name] = message || `Maximum value is ${max}`;
        if (pattern && typeof value === "string" && !new RegExp(pattern).test(value)) newErrors[field.name] = message || "Invalid format";
      }
      if (field.type === "email" && typeof value === "string" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field.name] = "Invalid email address";
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    window.dispatchEvent(new CustomEvent("visualization-form-submit", { detail: { action: submitAction, data: formData } }));
    setSubmitted(true);
  };

  const handleCancel = () => {
    window.dispatchEvent(new CustomEvent("visualization-form-cancel", { detail: { action: submitAction } }));
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <p className="text-lg font-semibold text-green-500 mb-1">Form Submitted</p>
        <p className="text-sm text-gray-500">Your response has been recorded.</p>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors";
  const errorClass = "border-red-500 focus:ring-red-500/20 focus:border-red-500";

  const renderField = (field: FormField) => {
    const value = formData[field.name];
    const error = errors[field.name];
    const hasError = !!error;

    switch (field.type) {
      case "text":
      case "email":
      case "number":
        return (
          <input
            type={field.type}
            placeholder={field.placeholder}
            required={field.required}
            value={String(value || "")}
            onChange={(e) => handleChange(field.name, field.type === "number" ? parseFloat(e.target.value) || "" : e.target.value)}
            className={cn(inputClass, hasError && errorClass)}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );
      case "textarea":
        return (
          <textarea
            placeholder={field.placeholder}
            required={field.required}
            value={String(value || "")}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={cn(inputClass, "min-h-[100px] resize-y", hasError && errorClass)}
            rows={4}
          />
        );
      case "select":
        return (
          <select
            value={String(value || "")}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={cn(inputClass, hasError && errorClass)}
          >
            <option value="" disabled>{field.placeholder || "Select an option"}</option>
            {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        );
      case "multiselect":
        return (
          <select
            multiple
            value={(value as string[]) || []}
            onChange={(e) => handleChange(field.name, Array.from(e.target.selectedOptions, (o) => o.value))}
            className={cn(inputClass, "min-h-[80px]", hasError && errorClass)}
          >
            {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!value} onChange={(e) => handleChange(field.name, e.target.checked)} className="w-4 h-4 accent-blue-500 rounded" />
            <span className="text-sm">{field.label}</span>
          </label>
        );
      case "radio":
        return (
          <div className="space-y-1">
            {field.options?.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name={field.name} value={opt.value} checked={value === opt.value} onChange={(e) => handleChange(field.name, e.target.value)} className="w-3.5 h-3.5 accent-blue-500" />
                {opt.label}
              </label>
            ))}
          </div>
        );
      case "date":
        return <input type="date" value={String(value || "")} onChange={(e) => handleChange(field.name, e.target.value)} className={cn(inputClass, hasError && errorClass)} />;
      case "datetime":
        return <input type="datetime-local" value={String(value || "")} onChange={(e) => handleChange(field.name, e.target.value)} className={cn(inputClass, hasError && errorClass)} />;
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.name}>
          {field.type !== "checkbox" && (
            <label className="block text-sm font-medium mb-1">
              {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          )}
          {renderField(field)}
          {errors[field.name] && <p className="text-xs text-red-500 mt-1">{errors[field.name]}</p>}
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={isStreaming} className="px-4 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
          {submitButtonText}
        </button>
        <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          {cancelButtonText}
        </button>
      </div>
    </form>
  );
}
