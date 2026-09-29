// Short names people type when signing in → their full name, so each person shows up once
// (keep in sync with canonical_person in supabase/modified-by.sql). "Ali" and "Ali Madad"
// are different people.
const ALIASES: Record<string, string> = {
  cesar: 'César Meneses',
  'césar': 'César Meneses',
  'cesar meneses': 'César Meneses',
  nicolas: 'Nicolas Loyola',
  'nicolás': 'Nicolas Loyola',
  natalia: 'Natalia Onate',
};

export const canonicalPerson = (name: string) => {
  const trimmed = name.trim();
  return ALIASES[trimmed.toLowerCase()] || trimmed;
};
