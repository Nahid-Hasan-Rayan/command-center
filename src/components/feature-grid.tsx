/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { FEATURE_CATALOG, type Feature } from "@/domain/features";

export function FeatureGrid({
  selected,
  idPrefix,
}: {
  selected: readonly Feature[];
  idPrefix: string;
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Visible features</legend>
      {FEATURE_CATALOG.map((feature) => (
        <label
          key={feature.id}
          htmlFor={`${idPrefix}-${feature.id}`}
          className="flex items-start gap-2 text-sm"
        >
          <input
            id={`${idPrefix}-${feature.id}`}
            type="checkbox"
            name="features"
            value={feature.id}
            defaultChecked={selected.includes(feature.id)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{feature.label}</span>
            <span className="block text-xs text-muted">{feature.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
