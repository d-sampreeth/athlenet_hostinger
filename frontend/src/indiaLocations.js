import { getAllStatesWithDistricts } from 'india-state-district';

const stateNameAliases = {
  AN: 'Andaman and Nicobar Islands',
  DL: 'Delhi',
};

const statesWithDistricts = getAllStatesWithDistricts().map(({ code, name, districts }) => ({
  name: stateNameAliases[code] || name,
  districts,
}));

export const INDIAN_STATES_AND_UTS = statesWithDistricts.map(({ name }) => name);

export function getDistrictsForState(state) {
  return statesWithDistricts.find(({ name }) => name === state)?.districts ?? [];
}
