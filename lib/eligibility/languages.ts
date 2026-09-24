export const languageOptions: [string, string][] = [
  ["en", "English"], ["hi", "Hindi"], ["ja", "Japanese"], ["fr", "French"],
  ["as", "Assamese"], ["bn", "Bengali"], ["brx", "Bodo"], ["doi", "Dogri"],
  ["gu", "Gujarati"], ["kn", "Kannada"], ["ks", "Kashmiri"], ["kok", "Konkani"],
  ["mai", "Maithili"], ["ml", "Malayalam"], ["mni", "Manipuri"], ["mr", "Marathi"],
  ["ne", "Nepali"], ["or", "Odia"], ["pa", "Punjabi"], ["sa", "Sanskrit"],
  ["sat", "Santali"], ["sd", "Sindhi"], ["ta", "Tamil"], ["te", "Telugu"], ["ur", "Urdu"],
  ["ar", "Arabic"], ["de", "German"], ["pt", "Portuguese"], ["es", "Spanish"], ["zh", "Chinese"],
];

export const languageName = (code: string) => languageOptions.find(([id]) => id === code)?.[1] ?? code;
