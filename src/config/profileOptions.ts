/// Choices offered by the profile, feedback and request forms.

/// Current year at university, stored as `users/{uid}.uniYear` by key
/// (keys are stored data — relabel freely, never rename a key). Mirrored
/// in firestore.rules.
export const UNI_YEARS = [
  { key: 'year1', label: '1st Year' },
  { key: 'year2', label: '2nd Year' },
  { key: 'year3', label: '3rd Year' },
  { key: 'year4', label: '4th Year' },
  { key: 'graduated', label: 'Graduated' },
] as const;

export const uniYearLabel = (key: string) => UNI_YEARS.find((y) => y.key === key)?.label ?? '';

/// Suggestions for the free-text Degree field (`degreeProgram`, the same
/// field sign-up saves). Any other degree can be typed in.
export const DEGREE_SUGGESTIONS = [
  'BSc (Hons) Computer Science',
  'BSc (Hons) Software Engineering',
  'BSc (Hons) Information Technology',
  'BSc (Hons) Information Systems',
  'BSc (Hons) Computer Engineering',
  'BSc (Hons) Data Science',
  'BSc (Hons) Cyber Security',
  'BSc (Hons) Artificial Intelligence',
  'BEng (Hons) Electronic and Telecommunication Engineering',
  'BSc Engineering (Hons) Computer Science and Engineering',
  'BIT (Bachelor of Information Technology)',
];

export const FEEDBACK_TYPES = [
  { key: 'bug', label: 'Bug' },
  { key: 'idea', label: 'Idea' },
  { key: 'other', label: 'Other' },
] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]['key'];

/// Length limits, mirrored in firestore.rules.
export const LIMITS = {
  name: 60,
  bio: 160,
  institution: 100,
  degree: 120,
  location: 60,
  feedback: 2000,
  requestTopic: 120,
  requestSubject: 80,
  requestGrade: 40,
  requestDetails: 1000,
};
