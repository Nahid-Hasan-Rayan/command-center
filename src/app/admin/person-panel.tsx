/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { Form } from "@/components/form";
import { Field, inputClass } from "@/components/ui";
import { FEATURE_CATALOG, type Feature } from "@/domain/features";
import {
  type AccountStatus,
  availableActions,
  DEFAULT_APPROVAL_FEATURES,
  REMOVAL_OPTIONS,
} from "@/domain/registration";
import {
  decideRegistrationAction,
  removeUserAction,
  setAdminRoleAction,
  setEntitlementsAction,
  setStatusAction,
} from "./actions";

export interface PersonRow {
  userId: string;
  email: string;
  fullName: string;
  whatsapp: string | null;
  matricId: string | null;
  note: string | null;
  status: AccountStatus;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  isAdmin: boolean;
  features: Feature[];
}

function FeatureBoxes({ selected }: { selected: readonly Feature[] }) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">Features</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {FEATURE_CATALOG.map((feature) => (
          <label key={feature.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="features"
              value={feature.id}
              defaultChecked={selected.includes(feature.id)}
              className="mt-1"
            />
            <span>
              {feature.label}
              <span className="block text-xs text-muted">{feature.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DecisionForms({ person }: { person: PersonRow }) {
  return (
    <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
      <Form action={decideRegistrationAction} submit="Approve">
        <input type="hidden" name="userId" value={person.userId} />
        <input type="hidden" name="decision" value="approve" />
        <FeatureBoxes selected={DEFAULT_APPROVAL_FEATURES} />
        <Field
          label="Message to the person (optional)"
          htmlFor={`approve-note-${person.userId}`}
          hint="Shown on their page."
        >
          <input
            id={`approve-note-${person.userId}`}
            name="note"
            maxLength={500}
            className={inputClass}
          />
        </Field>
      </Form>
      <Form action={decideRegistrationAction} submit="Decline" tone="danger">
        <input type="hidden" name="userId" value={person.userId} />
        <input type="hidden" name="decision" value="reject" />
        <Field
          label="Reason (optional)"
          htmlFor={`reject-note-${person.userId}`}
          hint="Shown on their page."
        >
          <input
            id={`reject-note-${person.userId}`}
            name="note"
            maxLength={500}
            className={inputClass}
          />
        </Field>
      </Form>
    </div>
  );
}

export function ManagePanel({
  person,
  viewerIsRoot,
}: {
  person: PersonRow;
  viewerIsRoot: boolean;
}) {
  const actions = availableActions(person.status);
  const protectedAccount = person.isAdmin && !viewerIsRoot;

  return (
    <div className="space-y-5 border-t border-border pt-4">
      {person.status === "pending" || person.status === "rejected" ? (
        <DecisionForms person={person} />
      ) : null}

      {person.status === "approved" ? (
        <Form action={setEntitlementsAction} submit="Save features" tone="quiet">
          <input type="hidden" name="userId" value={person.userId} />
          <FeatureBoxes selected={person.features} />
        </Form>
      ) : null}

      {actions.includes("suspend") || actions.includes("reinstate") ? (
        <Form
          action={setStatusAction}
          submit={actions.includes("suspend") ? "Suspend access" : "Restore access"}
          tone="quiet"
        >
          <input type="hidden" name="userId" value={person.userId} />
          <input
            type="hidden"
            name="status"
            value={actions.includes("suspend") ? "suspended" : "approved"}
          />
          <Field label="Note (optional)" htmlFor={`status-note-${person.userId}`}>
            <input
              id={`status-note-${person.userId}`}
              name="note"
              maxLength={500}
              className={inputClass}
            />
          </Field>
        </Form>
      ) : null}

      {viewerIsRoot && person.status === "approved" ? (
        <Form
          action={setAdminRoleAction}
          submit={person.isAdmin ? "Remove administrator role" : "Make administrator"}
          tone="quiet"
        >
          <input type="hidden" name="userId" value={person.userId} />
          <input type="hidden" name="makeAdmin" value={person.isAdmin ? "false" : "true"} />
          <p className="text-sm text-muted">
            Administrators can approve people and see everything. Only you can change this.
          </p>
        </Form>
      ) : null}

      {protectedAccount ? (
        <p className="text-sm text-muted">
          Only the primary administrator can change another administrator.
        </p>
      ) : (
        <Form action={removeUserAction} submit="Apply" tone="danger">
          <input type="hidden" name="userId" value={person.userId} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Remove this person. Choose what happens:
            </legend>
            {REMOVAL_OPTIONS.map((option) => (
              <label key={option.id} className="flex items-start gap-2 text-sm">
                <input type="radio" name="option" value={option.id} required className="mt-1" />
                <span>
                  {option.label}
                  <span className="block text-xs text-muted">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Field label="Note (optional)" htmlFor={`remove-note-${person.userId}`}>
            <input
              id={`remove-note-${person.userId}`}
              name="note"
              maxLength={500}
              className={inputClass}
            />
          </Field>
          <Field
            label="Confirm email (only for permanent deletion)"
            htmlFor={`remove-confirm-${person.userId}`}
            hint={`Type ${person.email} to delete this account and all of its data.`}
          >
            <input
              id={`remove-confirm-${person.userId}`}
              name="confirmEmail"
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        </Form>
      )}
    </div>
  );
}
