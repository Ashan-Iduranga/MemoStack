const emailRegex = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

export const Validators = {
  email(value: string): string | null {
    if (value.trim().length === 0) return 'Email is required';
    if (!emailRegex.test(value.trim())) return 'Enter a valid email';
    return null;
  },
  password(value: string): string | null {
    if (value.length === 0) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return null;
  },
  required(value: string, label = 'This field'): string | null {
    if (value.trim().length === 0) return `${label} is required`;
    return null;
  },
};

/// A starter list of Sri Lankan universities offering computing degrees.
/// Purely a convenience picker for registration — students can also type
/// their own via the "Other" option.
export const sriLankanUniversities = [
  'University of Colombo School of Computing (UCSC)',
  'University of Moratuwa',
  'University of Peradeniya',
  'University of Kelaniya',
  'University of Sri Jayewardenepura',
  'University of Jaffna',
  'University of Ruhuna',
  'Sabaragamuwa University of Sri Lanka',
  'Rajarata University of Sri Lanka',
  'South Eastern University of Sri Lanka',
  'Uva Wellassa University',
  'Sri Lanka Institute of Information Technology (SLIIT)',
  'Informatics Institute of Technology (IIT)',
  'NSBM Green University (NSBM)',
  'National Institute of Business Management (NIBM)',
  'Other',
];

/// Adds `https://` when the admin types a bare domain like "example.com".
export function normalizeUrl(input: string): string {
  const url = input.trim();
  if (url.length === 0) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
}
