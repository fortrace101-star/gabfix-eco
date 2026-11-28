import type { FormField, FormValue } from '@mobile/lib/form-schema';

/** One customer-facing field inside the phone preview. */
export function PreviewField({
  field,
  value,
  error,
  mediaCount,
  onChange,
  onAddMedia,
}: {
  field: FormField;
  value: FormValue | undefined;
  error?: string;
  mediaCount: number;
  onChange: (value: FormValue) => void;
  onAddMedia: () => void;
}) {
  return (
    <div className="preview-field">
      <span className="preview-label">
        {field.label}
        {field.required ? <em> *</em> : null}
      </span>
      {field.helper ? <span className="preview-helper">{field.helper}</span> : null}
      <PreviewControl
        field={field}
        value={value}
        mediaCount={mediaCount}
        onChange={onChange}
        onAddMedia={onAddMedia}
      />
      {error ? (
        <span className="preview-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function PreviewControl({
  field,
  value,
  mediaCount,
  onChange,
  onAddMedia,
}: {
  field: FormField;
  value: FormValue | undefined;
  mediaCount: number;
  onChange: (value: FormValue) => void;
  onAddMedia: () => void;
}) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className="phone-input phone-textarea"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          aria-label={field.label}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'text':
      return (
        <input
          className="phone-input"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          aria-label={field.label}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'number':
      return (
        <span className="phone-number">
          <input
            className="phone-input"
            type="number"
            value={value == null ? '' : String(value)}
            placeholder={field.placeholder}
            aria-label={field.label}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(raw.trim() === '' ? null : Number(raw));
            }}
          />
          {field.unit ? <span className="phone-unit">{field.unit}</span> : null}
        </span>
      );

    case 'counter': {
      const numeric = typeof value === 'number' ? value : Number(value ?? 0) || 0;
      const min = field.min ?? 0;
      const max = field.max ?? 20;
      return (
        <span className="phone-counter">
          <button
            type="button"
            aria-label={`Decrease ${field.label}`}
            disabled={numeric <= min}
            onClick={() => onChange(Math.max(min, numeric - 1))}
          >
            −
          </button>
          <strong>{numeric}</strong>
          <button
            type="button"
            aria-label={`Increase ${field.label}`}
            disabled={numeric >= max}
            onClick={() => onChange(Math.min(max, numeric + 1))}
          >
            +
          </button>
        </span>
      );
    }

    case 'select': {
      const options = field.options ?? [];
      const selected = typeof value === 'string' ? value : '';
      if (options.length <= 6) {
        return (
          <div className="phone-cards" role="radiogroup" aria-label={field.label}>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected === option.id}
                className={selected === option.id ? 'phone-card phone-card-on' : 'phone-card'}
                onClick={() => onChange(option.id)}
              >
                <span>{option.label}</span>
                {option.hint ? <small>{option.hint}</small> : null}
              </button>
            ))}
          </div>
        );
      }
      return (
        <div className="phone-chips" role="radiogroup" aria-label={field.label}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected === option.id}
              className={selected === option.id ? 'phone-chip phone-chip-on' : 'phone-chip'}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }

    case 'multiselect': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="phone-chips" role="group" aria-label={field.label}>
          {(field.options ?? []).map((option) => {
            const on = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                className={on ? 'phone-chip phone-chip-on' : 'phone-chip'}
                onClick={() =>
                  onChange(
                    on
                      ? selected.filter((id) => id !== option.id)
                      : [...selected, option.id],
                  )
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }

    case 'boolean':
      return (
        <div className="phone-chips" role="radiogroup" aria-label={field.label}>
          {[
            { label: 'Yes', next: true },
            { label: 'No', next: false },
          ].map(({ label, next }) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={value === next}
              className={value === next ? 'phone-chip phone-chip-on' : 'phone-chip'}
              onClick={() => onChange(next)}
            >
              {label}
            </button>
          ))}
        </div>
      );

    case 'measurement': {
      const measured =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as { value: number; unit: string })
          : null;
      return (
        <span className="phone-number">
          <input
            className="phone-input"
            type="number"
            value={measured ? String(measured.value) : ''}
            placeholder="0"
            aria-label={field.label}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(
                raw.trim() === ''
                  ? null
                  : { value: Number(raw), unit: field.unit ?? 'm²' },
              );
            }}
          />
          <span className="phone-unit">{field.unit ?? 'm²'}</span>
        </span>
      );
    }

    case 'media-slot': {
      const max = field.maxMedia ?? 5;
      return (
        <button
          type="button"
          className="phone-media"
          aria-label={`${field.label}. ${mediaCount} of ${max} added`}
          onClick={onAddMedia}
        >
          <span className="phone-media-plus">{mediaCount > 0 ? '✓' : '+'}</span>
          <span>
            {mediaCount > 0 ? `${mediaCount} of ${max} added` : 'Add a photo or video'}
          </span>
        </button>
      );
    }

    default:
      return null;
  }
}
