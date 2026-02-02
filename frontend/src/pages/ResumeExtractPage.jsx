import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Utility: Deep clone a JSON-serializable object.
 */
function cloneDeep(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

/**
 * Utility: Convert array of strings to a newline-separated string.
 */
function toLines(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join("\n");
}

/**
 * Utility: Convert newline-separated string back into an array of trimmed strings.
 */
function fromLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Utility: Format bytes into human-readable sizes.
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function getBirthYearFromDob(dateOfBirth) {
  const match = String(dateOfBirth || "").match(/^(\d{4})/);
  return match ? match[1] : "";
}

function sanitizeBirthYearInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function getLatestJobTitle(workItems) {
  const items = Array.isArray(workItems) ? workItems : [];
  const currentRole = items.find((wk) => String(wk?.is_current || "").toLowerCase() === "true");
  if (currentRole?.job_title) return currentRole.job_title;

  let best = "";
  let bestDate = "";
  items.forEach((wk) => {
    const endDate = String(wk?.end_date || "");
    if (endDate && endDate > bestDate && wk?.job_title) {
      bestDate = endDate;
      best = wk.job_title;
    }
  });

  return best;
}

function getBirthYearFromDob(dateOfBirth) {
  const match = String(dateOfBirth || "").match(/^(\d{4})/);
  return match ? match[1] : "";
}

function sanitizeBirthYearInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function getLatestJobTitle(workItems) {
  const items = Array.isArray(workItems) ? workItems : [];
  const currentRole = items.find((wk) => String(wk?.is_current || "").toLowerCase() === "true");
  if (currentRole?.job_title) return currentRole.job_title;

  let best = "";
  let bestDate = "";
  items.forEach((wk) => {
    const endDate = String(wk?.end_date || "");
    if (endDate && endDate > bestDate && wk?.job_title) {
      bestDate = endDate;
      best = wk.job_title;
    }
  });

  return best;
}

const RESUME_SCHEMA_KEY = "resumeSchemaCommand";
const DEFAULT_RESUME_SCHEMA = "resume-extract-v3.json";
const RESUME_SCHEMA_OPTIONS = new Set([
  "resume-extract-v3.json",
  "resume-extract-v2.json",
  "resume-extract-v1.json",
  "extract-v1.json",
]);

function getSelectedSchemaCommand() {
  // Pull the schema selection saved in Settings.
  const stored = localStorage.getItem(RESUME_SCHEMA_KEY);
  return RESUME_SCHEMA_OPTIONS.has(stored) ? stored : DEFAULT_RESUME_SCHEMA;
}

const INDUSTRIES = [
  'Accounting',
  'Agriculture & Farming',
  'Airlines & Aviation',
  'Animation',
  'Architecture & Planning',
  'Arts & Crafts',
  'Automotive',
  'Banking',
  'Biotechnology',
  'Broadcast Media',
  'Building Materials',
  'Business Supplies & Equipment',
  'Chemicals',
  'Civic & Social Organization',
  'Civil Engineering',
  'Commercial Real Estate',
  'Computer & Network Security',
  'Computer Games',
  'Computer Hardware',
  'Computer Networking',
  'Computer Software',
  'Construction',
  'Consumer Electronics',
  'Consumer Goods',
  'Consumer Services',
  'Cosmetics',
  'Dairy',
  'Defense & Space',
  'Design',
  'E-Learning',
  'Education Management',
  'Electrical & Electronic Manufacturing',
  'Entertainment',
  'Environmental Services',
  'Events Services',
  'Executive Office',
  'Facilities Services',
  'Farming',
  'Financial Services',
  'Fine Art',
  'Fishery',
  'Food & Beverages',
  'Food Production',
  'Fundraising',
  'Furniture',
  'Gambling & Casinos',
  'Glass, Ceramics & Concrete',
  'Government Administration',
  'Government Relations',
  'Graphic Design',
  'Health, Wellness & Fitness',
  'Healthcare',
  'Higher Education',
  'Hospital & Health Care',
  'Hospitality',
  'Human Resources',
  'Import & Export',
  'Individual & Family Services',
  'Industrial Automation',
  'Information Services',
  'Information Technology & Services',
  'Insurance',
  'International Affairs',
  'International Trade & Development',
  'Internet',
  'Investment Banking',
  'Investment Management',
  'Judiciary',
  'Law Enforcement',
  'Law Practice',
  'Legal Services',
  'Legislative Office',
  'Leisure, Travel & Tourism',
  'Libraries',
  'Logistics & Supply Chain',
  'Luxury Goods & Jewelry',
  'Machinery',
  'Management Consulting',
  'Manufacturing',
  'Maritime',
  'Market Research',
  'Marketing & Advertising',
  'Mechanical or Industrial Engineering',
  'Media Production',
  'Medical Devices',
  'Medical Practice',
  'Mental Health Care',
  'Military',
  'Mining & Metals',
  'Motion Pictures & Film',
  'Museums & Institutions',
  'Music',
  'Nanotechnology',
  'Newspapers',
  'Non-Profit Organization Management',
  'Oil & Energy',
  'Online Media',
  'Outsourcing/Offshoring',
  'Package/Freight Delivery',
  'Packaging & Containers',
  'Paper & Forest Products',
  'Performing Arts',
  'Pharmaceuticals',
  'Philanthropy',
  'Photography',
  'Plastics',
  'Political Organization',
  'Primary/Secondary Education',
  'Printing',
  'Professional Training & Coaching',
  'Program Development',
  'Public Policy',
  'Public Relations & Communications',
  'Public Safety',
  'Publishing',
  'Railroad Manufacture',
  'Ranching',
  'Real Estate',
  'Recreational Facilities & Services',
  'Religious Institutions',
  'Renewables & Environment',
  'Research',
  'Restaurants',
  'Retail',
  'Security & Investigations',
  'Semiconductors',
  'Shipbuilding',
  'Sporting Goods',
  'Sports',
  'Staffing & Recruiting',
  'Supermarkets',
  'Telecommunications',
  'Textiles',
  'Think Tanks',
  'Tobacco',
  'Translation & Localization',
  'Transportation/Trucking/Railroad',
  'Utilities',
  'Venture Capital & Private Equity',
  'Veterinary',
  'Warehousing',
  'Wholesale',
  'Wine & Spirits',
  'Wireless',
  'Writing & Editing',
  'Other'
];
const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua & Barbuda',
  'Argentina',
  'Armenia',
  'Aruba',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia & Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Republic',
  'Chad',
  'Chile',
  'China Mainland',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cura?ao',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Faroe Islands',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Greenland',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Hong Kong',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Macau',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Montserrat',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Helena',
  'Saint Kitts & Nevis',
  'Saint Lucia',
  'Saint Vincent',
  'Samoa',
  'San Marino',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad & Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe'
];
const EDUCATION_LEVELS = [
  "High School",
  "Associate's Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate",
  "Professional Degree",
  "Others",
];
// Phone countries exclude flags to keep the list lightweight.
const PHONE_COUNTRIES = [
  { name: 'Afghanistan', code: 'AF', dial: '+93', format: '## ### ####' },
  { name: 'Albania', code: 'AL', dial: '+355', format: '## ### ####' },
  { name: 'Algeria', code: 'DZ', dial: '+213', format: '### ## ## ##' },
  { name: 'Andorra', code: 'AD', dial: '+376', format: '### ###' },
  { name: 'Angola', code: 'AO', dial: '+244', format: '### ### ###' },
  { name: 'Antigua & Barbuda', code: 'AG', dial: '+1-268', format: '(###) ###-####' },
  { name: 'Argentina', code: 'AR', dial: '+54', format: '## ####-####' },
  { name: 'Armenia', code: 'AM', dial: '+374', format: '## ######' },
  { name: 'Aruba', code: 'AW', dial: '+297', format: '### ####' },
  { name: 'Australia', code: 'AU', dial: '+61', format: '### ### ###' },
  { name: 'Austria', code: 'AT', dial: '+43', format: '### ######' },
  { name: 'Azerbaijan', code: 'AZ', dial: '+994', format: '## ### ## ##' },
  { name: 'Bahamas', code: 'BS', dial: '+1-242', format: '(###) ###-####' },
  { name: 'Bahrain', code: 'BH', dial: '+973', format: '#### ####' },
  { name: 'Bangladesh', code: 'BD', dial: '+880', format: '####-######' },
  { name: 'Barbados', code: 'BB', dial: '+1-246', format: '(###) ###-####' },
  { name: 'Belarus', code: 'BY', dial: '+375', format: '## ###-##-##' },
  { name: 'Belgium', code: 'BE', dial: '+32', format: '### ## ## ##' },
  { name: 'Belize', code: 'BZ', dial: '+501', format: '###-####' },
  { name: 'Benin', code: 'BJ', dial: '+229', format: '## ## ####' },
  { name: 'Bhutan', code: 'BT', dial: '+975', format: '## ### ###' },
  { name: 'Bolivia', code: 'BO', dial: '+591', format: '# ### ####' },
  { name: 'Bosnia & Herzegovina', code: 'BA', dial: '+387', format: '## ####-###' },
  { name: 'Botswana', code: 'BW', dial: '+267', format: '## ### ###' },
  { name: 'Brazil', code: 'BR', dial: '+55', format: '(##) #####-####' },
  { name: 'Brunei', code: 'BN', dial: '+673', format: '### ####' },
  { name: 'Bulgaria', code: 'BG', dial: '+359', format: '### ### ###' },
  { name: 'Burkina Faso', code: 'BF', dial: '+226', format: '## ## ####' },
  { name: 'Burundi', code: 'BI', dial: '+257', format: '## ## ####' },
  { name: 'Cambodia', code: 'KH', dial: '+855', format: '## ### ###' },
  { name: 'Cameroon', code: 'CM', dial: '+237', format: '#### ####' },
  { name: 'Canada', code: 'CA', dial: '+1', format: '(###) ###-####' },
  { name: 'Cape Verde', code: 'CV', dial: '+238', format: '### ####' },
  { name: 'Central African Republic', code: 'CF', dial: '+236', format: '## ## ####' },
  { name: 'Chad', code: 'TD', dial: '+235', format: '## ## ## ##' },
  { name: 'Chile', code: 'CL', dial: '+56', format: '# #### ####' },
  { name: 'China Mainland', code: 'CN', dial: '+86', format: '### #### ####' },
  { name: 'Colombia', code: 'CO', dial: '+57', format: '### ### ####' },
  { name: 'Comoros', code: 'KM', dial: '+269', format: '### ####' },
  { name: 'Congo', code: 'CG', dial: '+242', format: '## ### ####' },
  { name: 'Costa Rica', code: 'CR', dial: '+506', format: '#### ####' },
  { name: 'Croatia', code: 'HR', dial: '+385', format: '## ### ####' },
  { name: 'Cuba', code: 'CU', dial: '+53', format: '# ### ####' },
  { name: 'Cura?ao', code: 'CW', dial: '+599', format: '### ####' },
  { name: 'Cyprus', code: 'CY', dial: '+357', format: '## ######' },
  { name: 'Czech Republic', code: 'CZ', dial: '+420', format: '### ### ###' },
  { name: 'Denmark', code: 'DK', dial: '+45', format: '## ## ## ##' },
  { name: 'Djibouti', code: 'DJ', dial: '+253', format: '## ## ## ##' },
  { name: 'Dominica', code: 'DM', dial: '+1-767', format: '(###) ###-####' },
  { name: 'Dominican Republic', code: 'DO', dial: '+1-809', format: '(###) ###-####' },
  { name: 'Ecuador', code: 'EC', dial: '+593', format: '## ### ####' },
  { name: 'Egypt', code: 'EG', dial: '+20', format: '### ### ####' },
  { name: 'El Salvador', code: 'SV', dial: '+503', format: '#### ####' },
  { name: 'Equatorial Guinea', code: 'GQ', dial: '+240', format: '### ### ###' },
  { name: 'Eritrea', code: 'ER', dial: '+291', format: '# ### ###' },
  { name: 'Estonia', code: 'EE', dial: '+372', format: '#### ####' },
  { name: 'Eswatini', code: 'SZ', dial: '+268', format: '## ## ####' },
  { name: 'Ethiopia', code: 'ET', dial: '+251', format: '## ### ####' },
  { name: 'Faroe Islands', code: 'FO', dial: '+298', format: '######' },
  { name: 'Fiji', code: 'FJ', dial: '+679', format: '### ####' },
  { name: 'Finland', code: 'FI', dial: '+358', format: '## ### ####' },
  { name: 'France', code: 'FR', dial: '+33', format: '# ## ## ## ##' },
  { name: 'Gabon', code: 'GA', dial: '+241', format: '## ## ####' },
  { name: 'Gambia', code: 'GM', dial: '+220', format: '### ####' },
  { name: 'Georgia', code: 'GE', dial: '+995', format: '### ### ###' },
  { name: 'Germany', code: 'DE', dial: '+49', format: '#### #######' },
  { name: 'Ghana', code: 'GH', dial: '+233', format: '### ### ###' },
  { name: 'Greece', code: 'GR', dial: '+30', format: '### ### ####' },
  { name: 'Greenland', code: 'GL', dial: '+299', format: '## ## ##' },
  { name: 'Grenada', code: 'GD', dial: '+1-473', format: '(###) ###-####' },
  { name: 'Guatemala', code: 'GT', dial: '+502', format: '#### ####' },
  { name: 'Guinea', code: 'GN', dial: '+224', format: '## ### ###' },
  { name: 'Guinea-Bissau', code: 'GW', dial: '+245', format: '### ####' },
  { name: 'Guyana', code: 'GY', dial: '+592', format: '### ####' },
  { name: 'Haiti', code: 'HT', dial: '+509', format: '## ## ####' },
  { name: 'Hong Kong', code: 'HK', dial: '+852', format: '#### ####' },
  { name: 'Honduras', code: 'HN', dial: '+504', format: '####-####' },
  { name: 'Hungary', code: 'HU', dial: '+36', format: '## ### ####' },
  { name: 'Iceland', code: 'IS', dial: '+354', format: '### ####' },
  { name: 'India', code: 'IN', dial: '+91', format: '#####-#####' },
  { name: 'Indonesia', code: 'ID', dial: '+62', format: '###-###-###' },
  { name: 'Iran', code: 'IR', dial: '+98', format: '### ### ####' },
  { name: 'Iraq', code: 'IQ', dial: '+964', format: '### ### ####' },
  { name: 'Ireland', code: 'IE', dial: '+353', format: '## ### ####' },
  { name: 'Israel', code: 'IL', dial: '+972', format: '##-###-####' },
  { name: 'Italy', code: 'IT', dial: '+39', format: '### ### ####' },
  { name: 'Jamaica', code: 'JM', dial: '+1-876', format: '(###) ###-####' },
  { name: 'Japan', code: 'JP', dial: '+81', format: '##-####-####' },
  { name: 'Jordan', code: 'JO', dial: '+962', format: '## #### ####' },
  { name: 'Kazakhstan', code: 'KZ', dial: '+7', format: '(###) ###-##-##' },
  { name: 'Kenya', code: 'KE', dial: '+254', format: '### ######' },
  { name: 'Kiribati', code: 'KI', dial: '+686', format: '## ###' },
  { name: 'Kosovo', code: 'XK', dial: '+383', format: '## ### ###' },
  { name: 'Kuwait', code: 'KW', dial: '+965', format: '#### ####' },
  { name: 'Kyrgyzstan', code: 'KG', dial: '+996', format: '### ######' },
  { name: 'Laos', code: 'LA', dial: '+856', format: '## ## ### ###' },
  { name: 'Latvia', code: 'LV', dial: '+371', format: '## ### ###' },
  { name: 'Lebanon', code: 'LB', dial: '+961', format: '## ### ###' },
  { name: 'Lesotho', code: 'LS', dial: '+266', format: '# ### ####' },
  { name: 'Liberia', code: 'LR', dial: '+231', format: '## ### ###' },
  { name: 'Libya', code: 'LY', dial: '+218', format: '##-#######' },
  { name: 'Liechtenstein', code: 'LI', dial: '+423', format: '### ####' },
  { name: 'Lithuania', code: 'LT', dial: '+370', format: '### #####' },
  { name: 'Luxembourg', code: 'LU', dial: '+352', format: '### ### ###' },
  { name: 'Macau', code: 'MO', dial: '+853', format: '#### ####' },
  { name: 'Madagascar', code: 'MG', dial: '+261', format: '## ## #####' },
  { name: 'Malawi', code: 'MW', dial: '+265', format: '# #### ####' },
  { name: 'Malaysia', code: 'MY', dial: '+60', format: '##-### ####' },
  { name: 'Maldives', code: 'MV', dial: '+960', format: '###-####' },
  { name: 'Mali', code: 'ML', dial: '+223', format: '## ## ####' },
  { name: 'Malta', code: 'MT', dial: '+356', format: '#### ####' },
  { name: 'Marshall Islands', code: 'MH', dial: '+692', format: '###-####' },
  { name: 'Mauritania', code: 'MR', dial: '+222', format: '## ## ####' },
  { name: 'Mauritius', code: 'MU', dial: '+230', format: '#### ####' },
  { name: 'Mexico', code: 'MX', dial: '+52', format: '### ### ####' },
  { name: 'Micronesia', code: 'FM', dial: '+691', format: '###-####' },
  { name: 'Moldova', code: 'MD', dial: '+373', format: '#### ####' },
  { name: 'Monaco', code: 'MC', dial: '+377', format: '## ## ## ##' },
  { name: 'Mongolia', code: 'MN', dial: '+976', format: '## ##-####' },
  { name: 'Montenegro', code: 'ME', dial: '+382', format: '## ### ###' },
  { name: 'Montserrat', code: 'MS', dial: '+1-664', format: '(###) ###-####' },
  { name: 'Morocco', code: 'MA', dial: '+212', format: '##-####-###' },
  { name: 'Mozambique', code: 'MZ', dial: '+258', format: '## ### ####' },
  { name: 'Myanmar', code: 'MM', dial: '+95', format: '## ### ###' },
  { name: 'Namibia', code: 'NA', dial: '+264', format: '## ### ####' },
  { name: 'Nauru', code: 'NR', dial: '+674', format: '### ####' },
  { name: 'Nepal', code: 'NP', dial: '+977', format: '##-#######' },
  { name: 'Netherlands', code: 'NL', dial: '+31', format: '## ########' },
  { name: 'New Zealand', code: 'NZ', dial: '+64', format: '##-###-####' },
  { name: 'Nicaragua', code: 'NI', dial: '+505', format: '#### ####' },
  { name: 'Niger', code: 'NE', dial: '+227', format: '## ## ####' },
  { name: 'Nigeria', code: 'NG', dial: '+234', format: '### ### ####' },
  { name: 'North Korea', code: 'KP', dial: '+850', format: '### #### ####' },
  { name: 'North Macedonia', code: 'MK', dial: '+389', format: '## ### ###' },
  { name: 'Norway', code: 'NO', dial: '+47', format: '### ## ###' },
  { name: 'Oman', code: 'OM', dial: '+968', format: '## ### ###' },
  { name: 'Pakistan', code: 'PK', dial: '+92', format: '####-#######' },
  { name: 'Palau', code: 'PW', dial: '+680', format: '### ####' },
  { name: 'Palestine', code: 'PS', dial: '+970', format: '## ### ####' },
  { name: 'Panama', code: 'PA', dial: '+507', format: '####-####' },
  { name: 'Papua New Guinea', code: 'PG', dial: '+675', format: '### ####' },
  { name: 'Paraguay', code: 'PY', dial: '+595', format: '### ######' },
  { name: 'Peru', code: 'PE', dial: '+51', format: '### ### ###' },
  { name: 'Philippines', code: 'PH', dial: '+63', format: '### ### ####' },
  { name: 'Poland', code: 'PL', dial: '+48', format: '### ### ###' },
  { name: 'Portugal', code: 'PT', dial: '+351', format: '## ### ####' },
  { name: 'Qatar', code: 'QA', dial: '+974', format: '#### ####' },
  { name: 'Romania', code: 'RO', dial: '+40', format: '### ### ###' },
  { name: 'Russia', code: 'RU', dial: '+7', format: '(###) ###-##-##' },
  { name: 'Rwanda', code: 'RW', dial: '+250', format: '### ### ###' },
  { name: 'Saint Helena', code: 'SH', dial: '+290', format: '####' },
  { name: 'Saint Kitts & Nevis', code: 'KN', dial: '+1-869', format: '(###) ###-####' },
  { name: 'Saint Lucia', code: 'LC', dial: '+1-758', format: '(###) ###-####' },
  { name: 'Saint Vincent', code: 'VC', dial: '+1-784', format: '(###) ###-####' },
  { name: 'Samoa', code: 'WS', dial: '+685', format: '## ####' },
  { name: 'San Marino', code: 'SM', dial: '+378', format: '## ## ## ##' },
  { name: 'Saudi Arabia', code: 'SA', dial: '+966', format: '## ### ####' },
  { name: 'Senegal', code: 'SN', dial: '+221', format: '## ### ####' },
  { name: 'Serbia', code: 'RS', dial: '+381', format: '## ### ####' },
  { name: 'Seychelles', code: 'SC', dial: '+248', format: '# ### ###' },
  { name: 'Sierra Leone', code: 'SL', dial: '+232', format: '## ######' },
  { name: 'Singapore', code: 'SG', dial: '+65', format: '#### ####' },
  { name: 'Slovakia', code: 'SK', dial: '+421', format: '### ### ###' },
  { name: 'Slovenia', code: 'SI', dial: '+386', format: '## ### ###' },
  { name: 'Solomon Islands', code: 'SB', dial: '+677', format: '### ####' },
  { name: 'Somalia', code: 'SO', dial: '+252', format: '## ### ###' },
  { name: 'South Africa', code: 'ZA', dial: '+27', format: '## ### ####' },
  { name: 'South Korea', code: 'KR', dial: '+82', format: '##-####-####' },
  { name: 'South Sudan', code: 'SS', dial: '+211', format: '## ### ####' },
  { name: 'Spain', code: 'ES', dial: '+34', format: '### ### ###' },
  { name: 'Sri Lanka', code: 'LK', dial: '+94', format: '## ### ####' },
  { name: 'Sudan', code: 'SD', dial: '+249', format: '## ### ####' },
  { name: 'Suriname', code: 'SR', dial: '+597', format: '###-####' },
  { name: 'Sweden', code: 'SE', dial: '+46', format: '##-### ## ##' },
  { name: 'Switzerland', code: 'CH', dial: '+41', format: '## ### ####' },
  { name: 'Syria', code: 'SY', dial: '+963', format: '## #### ###' },
  { name: 'Taiwan', code: 'TW', dial: '+886', format: '### ### ###' },
  { name: 'Tajikistan', code: 'TJ', dial: '+992', format: '## ### ####' },
  { name: 'Tanzania', code: 'TZ', dial: '+255', format: '## ### ####' },
  { name: 'Thailand', code: 'TH', dial: '+66', format: '##-###-####' },
  { name: 'Timor-Leste', code: 'TL', dial: '+670', format: '### ####' },
  { name: 'Togo', code: 'TG', dial: '+228', format: '## ### ###' },
  { name: 'Tonga', code: 'TO', dial: '+676', format: '### ####' },
  { name: 'Trinidad & Tobago', code: 'TT', dial: '+1-868', format: '(###) ###-####' },
  { name: 'Tunisia', code: 'TN', dial: '+216', format: '## ### ###' },
  { name: 'Turkey', code: 'TR', dial: '+90', format: '### ### ####' },
  { name: 'Turkmenistan', code: 'TM', dial: '+993', format: '## ######' },
  { name: 'Tuvalu', code: 'TV', dial: '+688', format: '## ####' },
  { name: 'Uganda', code: 'UG', dial: '+256', format: '### ######' },
  { name: 'Ukraine', code: 'UA', dial: '+380', format: '## ### ####' },
  { name: 'United Arab Emirates', code: 'AE', dial: '+971', format: '## ### ####' },
  { name: 'United Kingdom', code: 'GB', dial: '+44', format: '#### ######' },
  { name: 'United States', code: 'US', dial: '+1', format: '(###) ###-####' },
  { name: 'Uruguay', code: 'UY', dial: '+598', format: '## ### ###' },
  { name: 'Uzbekistan', code: 'UZ', dial: '+998', format: '## ### ####' },
  { name: 'Vanuatu', code: 'VU', dial: '+678', format: '### ####' },
  { name: 'Vatican City', code: 'VA', dial: '+379', format: '## #### ####' },
  { name: 'Venezuela', code: 'VE', dial: '+58', format: '###-#######' },
  { name: 'Vietnam', code: 'VN', dial: '+84', format: '### ### ####' },
  { name: 'Yemen', code: 'YE', dial: '+967', format: '### ### ###' },
  { name: 'Zambia', code: 'ZM', dial: '+260', format: '## ### ####' },
  { name: 'Zimbabwe', code: 'ZW', dial: '+263', format: '## ### ####' },
];
const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Freelance", "Internship"];
const CONTRACT_TYPES = ["Full time", "Part time", "Fixed-term contract", "Others"];
const WORK_MODES = ["Onsite", "Remote", "Hybrid"];
const GRADE_TYPES = [
  "GPA (4.0 scale)",
  "CGPS",
  "Percentage",
  "Letter Grade (A, B, C)",
  "Pass / Fail",
  "Other",
];

function isEmpty(value) {
  return String(value || "").trim() === "";
}

function getFileMeta(file) {
  if (!file) {
    return { name: "", type: "", size: "" };
  }
  return {
    name: file.name || "",
    type: file.type || "",
    size: String(file.size || ""),
  };
}

/**
 * Returns a blank resume structure matching the defined schema.
 */
function emptyResume() {
  return {
    personal_profile: {
      first_name: "",
      last_name: "",
      professional_headline: "",
      date_of_birth: "",
      phone_country_code: "",
      phone: "",
      email: "",
      location: "",
      highest_education_level: "",
      highest_education_year: "",
      website_links: [],
      skill_keywords: [],
      bio: "",
    },
    work_experience: [],
    education_history: [],
    licenses_certificates: [],
    optional_sections: [],
  };
}

function normalizeResume(resume) {
  const r = resume || {};
  const legacyWork = Array.isArray(r.work_history) ? r.work_history : [];
  const rawEducation = Array.isArray(r.education_history) ? r.education_history : [];
  const workExperience =
    Array.isArray(r.work_experience) && r.work_experience.length > 0
      ? r.work_experience
      : legacyWork.map((wk) => ({
          job_title: wk?.role_name ?? "",
          company_name: wk?.company_name ?? "",
          location: "",
          industry: "",
          employment_type: "",
          contract_type: "",
          work_mode: "",
          start_date: wk?.start_time ?? "",
          end_date: wk?.end_time ?? "",
          is_current: "",
          job_description: Array.isArray(wk?.descriptions) ? wk.descriptions.join("\n") : "",
          supporting_document_name: "",
          supporting_document_type: "",
          supporting_document_size: "",
        }));
  const shouldMapEducation =
    rawEducation.length > 0 &&
    rawEducation.some((ed) => ed?.start_time || ed?.end_time || Array.isArray(ed?.descriptions));
  const educationHistory =
    rawEducation.length > 0 && !shouldMapEducation
      ? rawEducation
      : rawEducation.map((ed) => ({
          degree_name: ed?.degree_name ?? "",
          school_name: ed?.school_name ?? "",
          location_country: "",
          location_state: "",
          start_date: ed?.start_time ?? "",
          end_date: ed?.end_time ?? "",
          is_current: "",
          grade_year: "",
          grade_type: "",
          grade_value: "",
          description: Array.isArray(ed?.descriptions) ? ed.descriptions.join("\n") : "",
          supporting_document_name: "",
          supporting_document_type: "",
          supporting_document_size: "",
        }));

  const inferredHeadline = r.personal_profile?.professional_headline ?? "";
  const resolvedHeadline = inferredHeadline || getLatestJobTitle(workExperience);

  return {
    personal_profile: {
      first_name: r.personal_profile?.first_name ?? "",
      last_name: r.personal_profile?.last_name ?? "",
      professional_headline: resolvedHeadline,
      date_of_birth: r.personal_profile?.date_of_birth ?? "",
      phone_country_code: r.personal_profile?.phone_country_code ?? "",
      phone: r.personal_profile?.phone ?? "",
      email: r.personal_profile?.email ?? "",
      location: r.personal_profile?.location ?? "",
      highest_education_level: r.personal_profile?.highest_education_level ?? "",
      highest_education_year: r.personal_profile?.highest_education_year ?? "",
      website_links: Array.isArray(r.personal_profile?.website_links) ? r.personal_profile.website_links : [],
      skill_keywords: Array.isArray(r.personal_profile?.skill_keywords) ? r.personal_profile.skill_keywords : [],
      bio: r.personal_profile?.bio ?? "",
    },
    work_experience: workExperience,
    education_history: educationHistory,
    licenses_certificates: Array.isArray(r.licenses_certificates) ? r.licenses_certificates : [],
    optional_sections: Array.isArray(r.optional_sections) ? r.optional_sections : [],
  };
}

function emptyEducation() {
  return {
    degree_name: "",
    school_name: "",
    location_country: "",
    location_state: "",
    start_date: "",
    end_date: "",
    is_current: "",
    grade_year: "",
    grade_type: "",
    grade_value: "",
    description: "",
    supporting_document_name: "",
    supporting_document_type: "",
    supporting_document_size: "",
  };
}

function emptyWork() {
  return {
    job_title: "",
    company_name: "",
    location: "",
    industry: "",
    employment_type: "",
    contract_type: "",
    work_mode: "",
    start_date: "",
    end_date: "",
    is_current: "",
    job_description: "",
    supporting_document_name: "",
    supporting_document_type: "",
    supporting_document_size: "",
  };
}

function emptyLicense() {
  return {
    qualification_name: "",
    issuing_organisation: "",
    issue_location_country: "",
    issue_location_state: "",
    issue_date: "",
    end_date: "",
    permanent_valid: "",
    last_renewal_date: "",
    industry: "",
    certificate_file_name: "",
    certificate_file_type: "",
    certificate_file_size: "",
  };
}

function emptyOptionalSection() {
  return {
    section_name: "",
    content: "",
  };
}

function withErrorStyle(base, hasError) {
  if (!hasError) return base;
  return { ...base, borderColor: "crimson", outlineColor: "crimson" };
}

function validateResume(resume, { birthYearOverride } = {}) {
  if (!resume) return [];
  const errors = [];

  const personal = resume.personal_profile || {};
  const birthYearValue = birthYearOverride ?? getBirthYearFromDob(personal.date_of_birth);
  if (isEmpty(personal.first_name)) errors.push("Personal Profile: First Name is required");
  if (isEmpty(personal.last_name)) errors.push("Personal Profile: Last Name is required");
  if (isEmpty(personal.professional_headline)) errors.push("Personal Profile: Professional Headline is required");
  if (isEmpty(birthYearValue)) {
    errors.push("Personal Profile: Birth Year is required");
  } else if (!/^\d{4}$/.test(birthYearValue)) {
    errors.push("Personal Profile: Birth Year must be a 4-digit year");
  }
  if (isEmpty(personal.location)) errors.push("Personal Profile: Location is required");
  if (isEmpty(personal.phone_country_code)) errors.push("Personal Profile: Phone Country Code is required");
  if (isEmpty(personal.phone)) errors.push("Personal Profile: Phone is required");
  if (isEmpty(personal.email)) errors.push("Personal Profile: Email is required");
  if (isEmpty(personal.highest_education_level)) errors.push("Personal Profile: Highest Education Level is required");
  if (isEmpty(personal.highest_education_year)) errors.push("Personal Profile: Highest Education Year is required");

  const workItems = Array.isArray(resume.work_experience) ? resume.work_experience : [];
  workItems.forEach((wk, idx) => {
    const prefix = `Work Experience #${idx + 1}`;
    if (isEmpty(wk.job_title)) errors.push(`${prefix}: Job Title is required`);
    if (isEmpty(wk.company_name)) errors.push(`${prefix}: Company Name is required`);
    if (isEmpty(wk.industry)) errors.push(`${prefix}: Industry is required`);
    if (isEmpty(wk.start_date)) errors.push(`${prefix}: Employment Start Date is required`);
    const isCurrent = String(wk.is_current || "").toLowerCase() === "true";
    if (!isCurrent && isEmpty(wk.end_date)) errors.push(`${prefix}: End Date is required unless currently working`);
  });

  const educationItems = Array.isArray(resume.education_history) ? resume.education_history : [];
  educationItems.forEach((ed, idx) => {
    const prefix = `Education #${idx + 1}`;
    if (isEmpty(ed.degree_name)) errors.push(`${prefix}: Degree Name is required`);
    if (isEmpty(ed.school_name)) errors.push(`${prefix}: School Name is required`);
    if (isEmpty(ed.location_country)) errors.push(`${prefix}: Country is required`);
    if (isEmpty(ed.location_state)) errors.push(`${prefix}: State is required`);
    if (isEmpty(ed.start_date)) errors.push(`${prefix}: Start Date is required`);
    const isCurrent = String(ed.is_current || "").toLowerCase() === "true";
    if (!isCurrent && isEmpty(ed.end_date)) errors.push(`${prefix}: End Date is required unless currently studying`);
  });

  const licenseItems = Array.isArray(resume.licenses_certificates) ? resume.licenses_certificates : [];
  licenseItems.forEach((lc, idx) => {
    const prefix = `License/Certificate #${idx + 1}`;
    if (isEmpty(lc.qualification_name)) errors.push(`${prefix}: Qualification Name is required`);
    if (isEmpty(lc.issuing_organisation)) errors.push(`${prefix}: Issuing Organisation is required`);
    if (isEmpty(lc.issue_location_country)) errors.push(`${prefix}: Country is required`);
    if (isEmpty(lc.issue_location_state)) errors.push(`${prefix}: State is required`);
    if (isEmpty(lc.issue_date)) errors.push(`${prefix}: Issue Date is required`);
    const isPermanent = String(lc.permanent_valid || "").toLowerCase() === "true";
    if (!isPermanent && isEmpty(lc.end_date)) errors.push(`${prefix}: End Date is required unless permanently valid`);
  });

  return errors;
}

function isFileHistoryItem(item) {
  const t = item?.request_type || "";
  return t === "file";
}

/**
 * Parses the raw JSON response from the LLM into a list of resume objects.
 */
function parseResultJsonToResumes(resultJsonText) {
  if (!resultJsonText) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(resultJsonText);
  } catch {
    return [];
  }

  // Schema expects { resumes: [...] }
  if (Array.isArray(parsed?.resumes)) return parsed.resumes;
  // Fallback for single object responses
  if (parsed && typeof parsed === "object" && parsed.personal_profile) return [parsed];

  return [];
}

export default function ResumeExtractPage() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || "", []);
  const fileInputRef = useRef(null);

  // Editable form state
  const [draftResumes, setDraftResumes] = useState([emptyResume()]);
  const [birthYearOverrides, setBirthYearOverrides] = useState([null]);
  const [selectedResumeIndex, setSelectedResumeIndex] = useState(0);
  const [showValidation, setShowValidation] = useState(false);

  // Extraction settings
  const [file, setFile] = useState(null);
  const [overwriteOnAnalyze, setOverwriteOnAnalyze] = useState(true);
  
  // NEW: State for the AI model provider (Default: ChatGPT/OpenAI)
  const [provider, setProvider] = useState("openai");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Raw preview of the current or last extraction
  const [extractedResult, setExtractedResult] = useState(null);

  // Request history
  const [history, setHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  const selectedHistoryItem = useMemo(
    () => history.find((h) => Number(h.id) === Number(selectedHistoryId)) || null,
    [history, selectedHistoryId]
  );

  const currentDraftResume = useMemo(() => {
    return draftResumes[selectedResumeIndex] || null;
  }, [draftResumes, selectedResumeIndex]);

  const birthYearOverride = birthYearOverrides[selectedResumeIndex] ?? null;
  const birthYearValue = currentDraftResume
    ? birthYearOverride ?? getBirthYearFromDob(currentDraftResume.personal_profile?.date_of_birth)
    : "";

  const validationErrors = useMemo(() => {
    if (!currentDraftResume) return [];
    const birthYearOverride = birthYearOverrides[selectedResumeIndex] ?? null;
    return validateResume(currentDraftResume, { birthYearOverride });
  }, [currentDraftResume, birthYearOverrides, selectedResumeIndex]);

  /**
   * Updates a specific field in the current draft resume.
   */
  function setResumeAtIndex(idx, updater) {
    setDraftResumes((prev) => {
      const next = prev.map((r) => cloneDeep(r));
      const cur = next[idx];
      if (!cur) return prev;
      next[idx] = updater(cur);
      return next;
    });
  }

  /**
   * Resets the entire page to a blank state.
   */
  function resetToEmptyForm() {
    setErrorMsg("");
    setExtractedResult(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDraftResumes([emptyResume()]);
    setBirthYearOverrides([null]);
    setSelectedResumeIndex(0);
    setSelectedHistoryId(null);
    setProvider("openai"); // Reset provider to default
    setShowValidation(false);
  }

  // Load request history on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${apiBase}/api/history?limit=200`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Failed to load history.");

        const items = Array.isArray(data.items) ? data.items : [];
        setHistory(items.filter(isFileHistoryItem));
      } catch (e) {
        setErrorMsg(e?.message || "Failed to load history.");
      }
    })();
  }, [apiBase]);

  /**
   * Populates the form using data from a previous extraction stored in history.
   */
  function loadHistoryItemToForm(item) {
    setSelectedHistoryId(item.id);
    setErrorMsg(item.error || "");

    const resumes = parseResultJsonToResumes(item.result_json);
    const normalized = resumes.map((r) => normalizeResume(r));

    if (!normalized.length) {
      setErrorMsg("This history item contains no usable resume data.");
      return;
    }

    setDraftResumes(normalized);
    setBirthYearOverrides(normalized.map(() => null));
    setSelectedResumeIndex(0);

    try {
      setExtractedResult(JSON.parse(item.result_json));
    } catch {
      setExtractedResult(null);
    }

    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /**
   * Deletes a single history entry.
   */
  async function deleteHistoryItem(id) {
    try {
      const resp = await fetch(`${apiBase}/api/history/${id}`, { method: "DELETE" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Delete failed.");

      setHistory((prev) => prev.filter((h) => Number(h.id) !== Number(id)));
      if (Number(selectedHistoryId) === Number(id)) setSelectedHistoryId(null);
    } catch (e) {
      setErrorMsg(e?.message || "Delete failed.");
    }
  }

  /**
   * Clears the file extraction history panel.
   */
  async function clearHistoryPanel() {
    if (history.length === 0) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      for (const item of history) {
        const resp = await fetch(`${apiBase}/api/history/${item.id}`, { method: "DELETE" });
        if (!resp.ok) throw new Error(`Failed clearing id=${item.id}`);
      }
      setHistory([]);
      setSelectedHistoryId(null);
    } catch (e) {
      setErrorMsg(e?.message || "Clear failed.");
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Sends the file to the backend for analysis using the selected AI provider.
   */
  async function handleAnalyze() {
    setErrorMsg("");
    setExtractedResult(null);

    if (!file) {
      setErrorMsg("No file selected. Please choose a file to import.");
      return;
    }

    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Use the schema selection saved in Settings (defaults to v3).
      const schemaCommand = getSelectedSchemaCommand();
      fd.append("command", schemaCommand);
      
      // Sends "openai", "gemini", or "claude" based on radio selection
      fd.append("provider", provider);

      const res = await fetch(`${apiBase}/api/analyze-file`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If the server returned a history item even on failure (error logging)
        if (data?.historyItem) {
          setHistory((prev) => [data.historyItem, ...prev]);
          setSelectedHistoryId(data.historyItem.id);
        }
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      // 1. Update the raw preview state
      const result = data?.result ?? null;
      setExtractedResult(result);

      // 2. Add the new successful extraction to the History sidebar
      if (data?.historyItem) {
        setHistory((prev) => [data.historyItem, ...prev]);
        setSelectedHistoryId(data.historyItem.id);
      }

      // 3. Process the extracted resume data for the form
      // The selected schema returns { "resumes": [...] }.
      const resumes = Array.isArray(result?.resumes) ? result.resumes : [];
      const normalized = resumes.map((r) => normalizeResume(r));

      if (normalized.length === 0) {
        throw new Error("The AI returned successfully, but no resume data was found in the output.");
      }

      // 4. Update the form draft state
      let nextSelectedIndex = 0;
      setDraftResumes((prev) => {
        if (overwriteOnAnalyze) {
          nextSelectedIndex = 0;
          return normalized;
        }
        // If not overwriting, append new resumes to the end of the existing list
        nextSelectedIndex = prev.length;
        return [...prev.map((r) => cloneDeep(r)), ...normalized];
      });

      if (overwriteOnAnalyze) {
        setBirthYearOverrides(normalized.map(() => null));
      } else {
        setBirthYearOverrides((prev) => [...prev, ...normalized.map(() => null)]);
      }

      setSelectedResumeIndex(nextSelectedIndex);

    } catch (err) {
      console.error("Analysis Error:", err);
      setErrorMsg(err?.message || "Failed to analyze the resume.");
    } finally {
      setIsLoading(false);
    }
  }

  function renderHistoryTitle(item) {
    const name = item.file_name || "(file)";
    return `FILE: ${name}`;
  }

  if (!currentDraftResume) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Resume Extract</h1>
        <p>Form state error. Please click Reset.</p>
        <button onClick={resetToEmptyForm}>Reset Form</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1250 }}>
      <h1>Resume Extract</h1>
      <p style={{ marginTop: 0 }}>
        Manually fill the form or import data using an AI model.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        
        {/* Left Panel: File Import & Main Form */}
        <div style={{ flex: 2, minWidth: 560 }}>
          
          <section
            style={{
              border: "1px solid var(--panel-border)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              background: "var(--panel-bg)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Import from Resume (Optional)</h2>

            {/* Model Selection Radio Buttons */}
            <div style={{ marginBottom: 15, display: "flex", flexWrap: "wrap", gap: 16 }}>
              <span style={{ fontWeight: 600 }}>AI Model:</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={provider === "openai"}
                  onChange={(e) => setProvider(e.target.value)}
                />
                ChatGPT 5.2
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="provider"
                  value="gemini"
                  checked={provider === "gemini"}
                  onChange={(e) => setProvider(e.target.value)}
                />
                Gemini 2.5 Flash
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="provider"
                  value="claude"
                  checked={provider === "claude"}
                  onChange={(e) => setProvider(e.target.value)}
                />
                Claude Sonnet 4
              </label>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={handleAnalyze} disabled={isLoading} style={{ fontWeight: 600 }}>
                {isLoading ? "Analyzing..." : "Analyze & Import"}
              </button>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={overwriteOnAnalyze}
                  onChange={(e) => setOverwriteOnAnalyze(e.target.checked)}
                />
                Overwrite form on import
              </label>

              <button type="button" onClick={resetToEmptyForm} disabled={isLoading}>
                Reset Form
              </button>

              {draftResumes.length > 1 && (
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Resume Index:
                  <select
                    value={selectedResumeIndex}
                    onChange={(e) => setSelectedResumeIndex(Number(e.target.value))}
                  >
                    {draftResumes.map((_, idx) => (
                      <option key={idx} value={idx}>
                        {idx + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* File metadata */}
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              {file ? (
                <div>
                  <div><strong>Selected:</strong> {file.name}</div>
                  <div><strong>Size:</strong> {formatBytes(file.size)}</div>
                  <div><strong>Type:</strong> {file.type || "unknown"}</div>
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No file selected.</div>
              )}
            </div>

            {errorMsg && (
              <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{errorMsg}</div>
            )}
          </section>

          {/* Application Form Sections */}
          <section
            style={{
              border: "1px solid var(--panel-border)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              background: "var(--panel-bg)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Application Form</h2>

            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setShowValidation(true)}>
                Validate Required Fields
              </button>
              {showValidation && validationErrors.length === 0 && (
                <span style={{ color: "green", fontWeight: 600 }}>All required fields look good.</span>
              )}
            </div>

            {showValidation && validationErrors.length > 0 && (
              <div style={{ marginBottom: 12, color: "crimson" }}>
                <strong>Missing required fields:</strong>
                <ul style={{ margin: "8px 0 0 18px" }}>
                  {validationErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Personal Profile Section */}
            <div
              style={{
                border: "1px solid var(--panel-border-subtle)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                background: "var(--panel-bg)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Personal Profile</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>First Name *</label>
                  <input
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.first_name))}
                    value={currentDraftResume.personal_profile.first_name}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.first_name = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Last Name *</label>
                  <input
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.last_name))}
                    value={currentDraftResume.personal_profile.last_name}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.last_name = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Professional Headline *</label>
                  <input
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.professional_headline))}
                    value={currentDraftResume.personal_profile.professional_headline}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.professional_headline = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Birth Year *</label>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="YYYY"
                    style={withErrorStyle(
                      { width: "100%", padding: 8 },
                      showValidation && (isEmpty(birthYearValue) || !/^\d{4}$/.test(birthYearValue))
                    )}
                    value={birthYearValue}
                    onChange={(e) => {
                      const nextValue = sanitizeBirthYearInput(e.target.value);
                      setBirthYearOverrides((prev) => {
                        const next = [...prev];
                        next[selectedResumeIndex] = nextValue;
                        return next;
                      });
                    }}
                  />
                </div>
                <div>
                  <label>Location *</label>
                  <input
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.location))}
                    value={currentDraftResume.personal_profile.location}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.location = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Country Code *</label>
                  <select
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.phone_country_code))}
                    value={currentDraftResume.personal_profile.phone_country_code}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.phone_country_code = e.target.value; return r; })}
                  >
                    <option value="">Select code</option>
                    {PHONE_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.dial}>{country.name} ({country.dial})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Phone *</label>
                  <input
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.phone))}
                    value={currentDraftResume.personal_profile.phone}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.phone = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Email *</label>
                  <input
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.email))}
                    value={currentDraftResume.personal_profile.email}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.email = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Highest Education Level *</label>
                  <select
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.highest_education_level))}
                    value={currentDraftResume.personal_profile.highest_education_level}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.highest_education_level = e.target.value; return r; })}
                  >
                    <option value="">Select Level</option>
                    {EDUCATION_LEVELS.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Highest Education Year *</label>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="YYYY"
                    style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(currentDraftResume.personal_profile.highest_education_year))}
                    value={currentDraftResume.personal_profile.highest_education_year}
                    onChange={(e) => {
                      const nextValue = sanitizeBirthYearInput(e.target.value);
                      setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.highest_education_year = nextValue; return r; });
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Skill Keywords (one per line)</label>
                <textarea
                  style={{ width: "100%", padding: 8, minHeight: 80 }}
                  value={toLines(currentDraftResume.personal_profile.skill_keywords)}
                  onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.skill_keywords = fromLines(e.target.value); return r; })}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Bio</label>
                <textarea
                  style={{ width: "100%", padding: 8, minHeight: 100 }}
                  value={currentDraftResume.personal_profile.bio}
                  onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.bio = e.target.value; return r; })}
                />
              </div>
            </div>

            {/* Education History Section */}
            <div
              style={{
                border: "1px solid var(--panel-border-subtle)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                background: "var(--panel-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Education History</h3>
                <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history = [...(r.education_history || []), emptyEducation()]; return r; })}>Add Education</button>
              </div>
              {currentDraftResume.education_history.map((ed, idx) => {
                const isCurrent = String(ed.is_current || "").toLowerCase() === "true";
                return (
                  <div
                    key={idx}
                    style={{ borderTop: "1px solid var(--panel-border-subtle)", paddingTop: 12, marginTop: 12 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Entry #{idx + 1}</strong>
                      <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history = r.education_history.filter((_, i) => i !== idx); return r; })}>Remove</button>
                    </div>
                    <label>Degree Name *</label>
                    <input placeholder="Degree Name" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(ed.degree_name))} value={ed.degree_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].degree_name = e.target.value; return r; })} />
                    <label>School Name *</label>
                    <input placeholder="School Name" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(ed.school_name))} value={ed.school_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].school_name = e.target.value; return r; })} />
                    <label>Country *</label>
                    <select style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(ed.location_country))} value={ed.location_country} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].location_country = e.target.value; return r; })}>
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <label>State *</label>
                    <input placeholder="State" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(ed.location_state))} value={ed.location_state} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].location_state = e.target.value; return r; })} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Start Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(ed.start_date))} value={ed.start_date} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].start_date = e.target.value; return r; })} />
                      </div>
                      <div>
                        <label>End Date (or expected) *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && !isCurrent && isEmpty(ed.end_date))} value={ed.end_date} disabled={isCurrent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].end_date = e.target.value; if (e.target.value) r.education_history[idx].is_current = ""; return r; })} />
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <input type="checkbox" checked={isCurrent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].is_current = e.target.checked ? "true" : ""; if (e.target.checked) r.education_history[idx].end_date = ""; return r; })} />
                          I currently study here
                        </label>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <strong>Grade Information (optional)</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                        <div>
                          <label>Year</label>
                          <input placeholder="Year" style={{ width: "100%", padding: 8 }} value={ed.grade_year} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].grade_year = e.target.value; return r; })} />
                        </div>
                        <div>
                          <label>Grade Type</label>
                          <select style={{ width: "100%", padding: 8 }} value={ed.grade_type} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].grade_type = e.target.value; return r; })}>
                            <option value="">Select grade type</option>
                            {GRADE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label>Grade</label>
                        <input placeholder="Grade" style={{ width: "100%", padding: 8 }} value={ed.grade_value} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].grade_value = e.target.value; return r; })} />
                      </div>
                    </div>
                    <label style={{ marginTop: 8, display: "block" }}>Description (optional)</label>
                    <textarea style={{ width: "100%", padding: 8, minHeight: 80 }} value={ed.description} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].description = e.target.value; return r; })} />
                    <div style={{ marginTop: 8 }}>
                      <label>Upload Supporting Document (optional)</label>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => { const meta = getFileMeta(e.target.files?.[0]); setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].supporting_document_name = meta.name; r.education_history[idx].supporting_document_type = meta.type; r.education_history[idx].supporting_document_size = meta.size; return r; }); }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Work Experience Section */}
            <div
              style={{
                border: "1px solid var(--panel-border-subtle)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                background: "var(--panel-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Work Experience</h3>
                <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience = [...(r.work_experience || []), emptyWork()]; return r; })}>Add Work</button>
              </div>
              {currentDraftResume.work_experience.map((wk, idx) => {
                const isCurrent = String(wk.is_current || "").toLowerCase() === "true";
                return (
                  <div
                    key={idx}
                    style={{ borderTop: "1px solid var(--panel-border-subtle)", paddingTop: 12, marginTop: 12 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Entry #{idx + 1}</strong>
                      <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience = r.work_experience.filter((_, i) => i !== idx); return r; })}>Remove</button>
                    </div>
                    <label>Job Title *</label>
                    <input placeholder="Job Title" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(wk.job_title))} value={wk.job_title} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].job_title = e.target.value; return r; })} />
                    <label>Company Name *</label>
                    <input placeholder="Company Name" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(wk.company_name))} value={wk.company_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].company_name = e.target.value; return r; })} />
                    <label>Location (optional)</label>
                    <input placeholder="Location" style={{ width: "100%", padding: 8, marginTop: 8 }} value={wk.location} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].location = e.target.value; return r; })} />
                    <label>Industry *</label>
                    <select style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(wk.industry))} value={wk.industry} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].industry = e.target.value; return r; })}>
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => (<option key={i} value={i}>{i}</option>))}
                    </select>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Employment Type (optional)</label>
                        <select style={{ width: "100%", padding: 8 }} value={wk.employment_type} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].employment_type = e.target.value; return r; })}>
                          <option value="">Select type</option>
                          {EMPLOYMENT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                        </select>
                      </div>
                      <div>
                        <label>Contract Type (optional)</label>
                        <select style={{ width: "100%", padding: 8 }} value={wk.contract_type} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].contract_type = e.target.value; return r; })}>
                          <option value="">Select type</option>
                          {CONTRACT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                        </select>
                      </div>
                      <div>
                        <label>Work Mode (optional)</label>
                        <select style={{ width: "100%", padding: 8 }} value={wk.work_mode} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].work_mode = e.target.value; return r; })}>
                          <option value="">Select mode</option>
                          {WORK_MODES.map((m) => (<option key={m} value={m}>{m}</option>))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Employment Start Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(wk.start_date))} value={wk.start_date} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].start_date = e.target.value; return r; })} />
                      </div>
                      <div>
                        <label>End Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && !isCurrent && isEmpty(wk.end_date))} value={wk.end_date} disabled={isCurrent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].end_date = e.target.value; if (e.target.value) r.work_experience[idx].is_current = ""; return r; })} />
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <input type="checkbox" checked={isCurrent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].is_current = e.target.checked ? "true" : ""; if (e.target.checked) r.work_experience[idx].end_date = ""; return r; })} />
                          I currently work here
                        </label>
                      </div>
                    </div>
                    <label style={{ marginTop: 8, display: "block" }}>Job Description (optional)</label>
                    <textarea style={{ width: "100%", padding: 8, minHeight: 80 }} value={wk.job_description} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].job_description = e.target.value; return r; })} />
                    <div style={{ marginTop: 8 }}>
                      <label>Upload Supporting Document (optional)</label>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => { const meta = getFileMeta(e.target.files?.[0]); setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].supporting_document_name = meta.name; r.work_experience[idx].supporting_document_type = meta.type; r.work_experience[idx].supporting_document_size = meta.size; return r; }); }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* License / Certificate Section */}
            <div
              style={{
                border: "1px solid var(--panel-border-subtle)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                background: "var(--panel-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>License / Certificate</h3>
                <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates = [...(r.licenses_certificates || []), emptyLicense()]; return r; })}>Add License/Certificate</button>
              </div>
              {currentDraftResume.licenses_certificates.map((lc, idx) => {
                const isPermanent = String(lc.permanent_valid || "").toLowerCase() === "true";
                return (
                  <div
                    key={idx}
                    style={{ borderTop: "1px solid var(--panel-border-subtle)", paddingTop: 12, marginTop: 12 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Entry #{idx + 1}</strong>
                      <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates = r.licenses_certificates.filter((_, i) => i !== idx); return r; })}>Remove</button>
                    </div>
                    <label>Qualification Name *</label>
                    <input placeholder="Qualification Name" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(lc.qualification_name))} value={lc.qualification_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].qualification_name = e.target.value; return r; })} />
                    <label>Issuing Organisation *</label>
                    <input placeholder="Issuing Organisation" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(lc.issuing_organisation))} value={lc.issuing_organisation} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].issuing_organisation = e.target.value; return r; })} />
                    <label>Issue Country *</label>
                    <select style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(lc.issue_location_country))} value={lc.issue_location_country} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].issue_location_country = e.target.value; return r; })}>
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <label>Issue State *</label>
                    <input placeholder="State" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(lc.issue_location_state))} value={lc.issue_location_state} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].issue_location_state = e.target.value; return r; })} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Issue Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(lc.issue_date))} value={lc.issue_date} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].issue_date = e.target.value; return r; })} />
                      </div>
                      <div>
                        <label>End Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && !isPermanent && isEmpty(lc.end_date))} value={lc.end_date} disabled={isPermanent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].end_date = e.target.value; if (e.target.value) r.licenses_certificates[idx].permanent_valid = ""; return r; })} />
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <input type="checkbox" checked={isPermanent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].permanent_valid = e.target.checked ? "true" : ""; if (e.target.checked) r.licenses_certificates[idx].end_date = ""; return r; })} />
                          Permanent Valid
                        </label>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label>Last Renewal Date (if applicable)</label>
                      <input type="date" style={{ width: "100%", padding: 8, marginTop: 8 }} value={lc.last_renewal_date} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].last_renewal_date = e.target.value; return r; })} />
                    </div>
                    <label style={{ marginTop: 8, display: "block" }}>Industry (optional)</label>
                    <select style={{ width: "100%", padding: 8 }} value={lc.industry} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].industry = e.target.value; return r; })}>
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => (<option key={i} value={i}>{i}</option>))}
                    </select>
                    <div style={{ marginTop: 8 }}>
                      <label>Upload Certificate File (optional)</label>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => { const meta = getFileMeta(e.target.files?.[0]); setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].certificate_file_name = meta.name; r.licenses_certificates[idx].certificate_file_type = meta.type; r.licenses_certificates[idx].certificate_file_size = meta.size; return r; }); }} />
                    </div>
                  </div>
                );
              })}
            </div>
            
          </section>

          {/* JSON Previews */}
          <section
            style={{
              border: "1px solid var(--panel-border)",
              borderRadius: 8,
              padding: 16,
              background: "var(--panel-bg)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>JSON Preview</h2>
            <pre
              style={{
                margin: 0,
                overflow: "auto",
                maxHeight: 400,
                background: "var(--pre-bg)",
                padding: 12,
              }}
            >
              {JSON.stringify({ resumes: draftResumes }, null, 2)}
            </pre>
            {extractedResult && (
              <div style={{ marginTop: 20 }}>
                <h3>Last Model Output (Raw)</h3>
                <pre
                  style={{
                    margin: 0,
                    overflow: "auto",
                    maxHeight: 400,
                    background: "var(--pre-bg-alt)",
                    padding: 12,
                  }}
                >
                  {JSON.stringify(extractedResult, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>

        {/* Right Panel: Extraction History */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Request History (File)</h3>
            <button onClick={clearHistoryPanel} disabled={isLoading || history.length === 0}>
              Clear Panel
            </button>
          </div>

          <div style={{ border: "1px solid var(--panel-border)" }}>
            {history.length === 0 ? (
              <div style={{ padding: 12 }}>No history found.</div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderBottom: "1px solid var(--panel-border-subtle)",
                    background:
                      Number(item.id) === Number(selectedHistoryId) ? "var(--panel-bg-alt)" : "var(--panel-bg)",
                  }}
                >
                  <button
                    onClick={() => loadHistoryItemToForm(item)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {item.created_at} • {item.status}
                    </div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{renderHistoryTitle(item)}</div>
                  </button>
                  <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
                    <button onClick={() => deleteHistoryItem(item.id)} disabled={isLoading}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedHistoryItem && (
            <div style={{ marginTop: 15 }}>
              <h4>History Item Detail</h4>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  padding: 10,
                  border: "1px solid var(--panel-border)",
                  maxHeight: 300,
                  overflow: "auto",
                  background: "var(--pre-bg)",
                }}
              >
                {JSON.stringify(JSON.parse(selectedHistoryItem.result_json || "{}"), null, 2)}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
