/** ISO 3166 reference lists used by forms and filters. Names come from the browser via Intl. */

export const countryCodes = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function sortedCountries(): { code: string; name: string }[] {
  return countryCodes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
}

/** States and union territories of India (ISO 3166-2:IN). */
export const indiaSubdivisions: [string, string][] = [
  ["IN-AN", "Andaman and Nicobar Islands"], ["IN-AP", "Andhra Pradesh"], ["IN-AR", "Arunachal Pradesh"], ["IN-AS", "Assam"],
  ["IN-BR", "Bihar"], ["IN-CH", "Chandigarh"], ["IN-CT", "Chhattisgarh"], ["IN-DH", "Dadra and Nagar Haveli and Daman and Diu"],
  ["IN-DL", "Delhi"], ["IN-GA", "Goa"], ["IN-GJ", "Gujarat"], ["IN-HR", "Haryana"], ["IN-HP", "Himachal Pradesh"],
  ["IN-JK", "Jammu and Kashmir"], ["IN-JH", "Jharkhand"], ["IN-KA", "Karnataka"], ["IN-KL", "Kerala"], ["IN-LA", "Ladakh"],
  ["IN-LD", "Lakshadweep"], ["IN-MP", "Madhya Pradesh"], ["IN-MH", "Maharashtra"], ["IN-MN", "Manipur"], ["IN-ML", "Meghalaya"],
  ["IN-MZ", "Mizoram"], ["IN-NL", "Nagaland"], ["IN-OR", "Odisha"], ["IN-PY", "Puducherry"], ["IN-PB", "Punjab"],
  ["IN-RJ", "Rajasthan"], ["IN-SK", "Sikkim"], ["IN-TN", "Tamil Nadu"], ["IN-TG", "Telangana"], ["IN-TR", "Tripura"],
  ["IN-UP", "Uttar Pradesh"], ["IN-UT", "Uttarakhand"], ["IN-WB", "West Bengal"],
];

/** US states, DC and territories (ISO 3166-2:US). */
export const usSubdivisions: [string, string][] = [
  ["US-AL", "Alabama"], ["US-AK", "Alaska"], ["US-AZ", "Arizona"], ["US-AR", "Arkansas"], ["US-CA", "California"],
  ["US-CO", "Colorado"], ["US-CT", "Connecticut"], ["US-DE", "Delaware"], ["US-DC", "District of Columbia"], ["US-FL", "Florida"],
  ["US-GA", "Georgia"], ["US-HI", "Hawaii"], ["US-ID", "Idaho"], ["US-IL", "Illinois"], ["US-IN", "Indiana"], ["US-IA", "Iowa"],
  ["US-KS", "Kansas"], ["US-KY", "Kentucky"], ["US-LA", "Louisiana"], ["US-ME", "Maine"], ["US-MD", "Maryland"],
  ["US-MA", "Massachusetts"], ["US-MI", "Michigan"], ["US-MN", "Minnesota"], ["US-MS", "Mississippi"], ["US-MO", "Missouri"],
  ["US-MT", "Montana"], ["US-NE", "Nebraska"], ["US-NV", "Nevada"], ["US-NH", "New Hampshire"], ["US-NJ", "New Jersey"],
  ["US-NM", "New Mexico"], ["US-NY", "New York"], ["US-NC", "North Carolina"], ["US-ND", "North Dakota"], ["US-OH", "Ohio"],
  ["US-OK", "Oklahoma"], ["US-OR", "Oregon"], ["US-PA", "Pennsylvania"], ["US-RI", "Rhode Island"], ["US-SC", "South Carolina"],
  ["US-SD", "South Dakota"], ["US-TN", "Tennessee"], ["US-TX", "Texas"], ["US-UT", "Utah"], ["US-VT", "Vermont"],
  ["US-VA", "Virginia"], ["US-WA", "Washington"], ["US-WV", "West Virginia"], ["US-WI", "Wisconsin"], ["US-WY", "Wyoming"],
  ["US-PR", "Puerto Rico"], ["US-GU", "Guam"], ["US-VI", "U.S. Virgin Islands"], ["US-AS", "American Samoa"], ["US-MP", "Northern Mariana Islands"],
];

export const subdivisionsByCountry: Record<string, [string, string][]> = { IN: indiaSubdivisions, US: usSubdivisions };

export function subdivisionName(code: string): string {
  for (const list of Object.values(subdivisionsByCountry)) {
    const found = list.find(([id]) => id === code);
    if (found) return found[1];
  }
  return code;
}
