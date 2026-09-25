import { RIDER_LEVEL_LABELS } from '@equime/shared';

import { Combobox } from '@/components/ui/combobox.jsx';
import { searchFamilies } from '@/features/admin/api.js';

/**
 * @typedef {{
 *   id: string,
 *   user: { id: string, firstName: string, lastName: string, email: string, banned?: boolean },
 *   riders: Array<{ id: string, firstName: string, lastName: string, level: string,
 *     subscriptions?: Array<{ id: string, plan: { name: string } }> }>,
 * }} FamilyOption
 */

/** @param {FamilyOption} family */
export function familyLabel(family) {
  return `${family.user.lastName.toUpperCase()} ${family.user.firstName}`;
}

/** @param {{ family: FamilyOption }} props */
function FamilyOptionView({ family }) {
  // Forfait de saison en cours à côté du prénom (ADR 011)
  const riders = family.riders
    .map((rider) =>
      rider.subscriptions?.[0]
        ? `${rider.firstName} (${rider.subscriptions[0].plan.name})`
        : rider.firstName
    )
    .join(', ');
  return (
    <span className="block">
      <span className="block font-semibold">{familyLabel(family)}</span>
      <span className="block text-xs text-muted-on-card">
        {riders ? `Cavaliers : ${riders}` : 'Aucun cavalier'}
        {' · '}
        {family.user.email}
      </span>
    </span>
  );
}

/**
 * Recherche d'une famille par le secrétariat (nom, e-mail, prénom d'un cavalier).
 * @param {{
 *   id: string,
 *   value: FamilyOption | null,
 *   onChange: (family: FamilyOption | null) => void,
 *   invalid?: boolean,
 *   onBlur?: () => void,
 * }} props
 */
export function FamilyPicker({ id, value, onChange, invalid, onBlur, ...aria }) {
  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      invalid={invalid}
      loadOptions={searchFamilies}
      getOptionKey={(family) => family.id}
      getOptionLabel={familyLabel}
      renderOption={(family) => <FamilyOptionView family={family} />}
      placeholder="Nom du parent, e-mail ou prénom d’un cavalier"
      emptyMessage="Aucune famille trouvée"
      {...aria}
    />
  );
}

/**
 * Variante « cavalier » : on cherche la famille, puis on choisit l'un de ses cavaliers.
 * Chaque cavalier devient une option (« Zoé MARTIN · Galop 2 — famille Martin »).
 * @param {{
 *   id: string,
 *   value: { rider: { id: string, firstName: string, lastName: string, level: string }, family: FamilyOption } | null,
 *   onChange: (value: { rider: object, family: FamilyOption } | null) => void,
 *   invalid?: boolean,
 * }} props
 */
export function RiderPicker({ id, value, onChange, invalid, ...aria }) {
  /** @param {string} q */
  const loadRiders = async (q) => {
    const families = await searchFamilies(q);
    return families.flatMap((family) => family.riders.map((rider) => ({ rider, family })));
  };
  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      invalid={invalid}
      loadOptions={loadRiders}
      getOptionKey={(option) => option.rider.id}
      getOptionLabel={(option) => `${option.rider.firstName} ${option.rider.lastName}`}
      renderOption={(option) => (
        <span className="block">
          <span className="block font-semibold">
            {option.rider.firstName} {option.rider.lastName}
          </span>
          <span className="block text-xs text-muted-on-card">
            {RIDER_LEVEL_LABELS[option.rider.level]} · famille {familyLabel(option.family)}
          </span>
        </span>
      )}
      placeholder="Prénom du cavalier ou nom du parent"
      emptyMessage="Aucun cavalier trouvé"
      {...aria}
    />
  );
}
