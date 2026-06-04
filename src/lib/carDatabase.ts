// Curated vehicle database for the Garage. Not exhaustive — covers most
// common makes and their popular models so users can pick instead of typing.

export type CarMake = {
  name: string;
  models: string[];
};

export const CAR_MAKES: CarMake[] = [
  { name: "Acura", models: ["ILX", "Integra", "MDX", "RDX", "TLX", "ZDX"] },
  { name: "Alfa Romeo", models: ["Giulia", "Stelvio", "Tonale"] },
  { name: "Aston Martin", models: ["DB11", "DB12", "DBS", "Vantage", "DBX"] },
  { name: "Audi", models: ["A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron", "RS6", "TT"] },
  { name: "BMW", models: ["1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "8 Series", "X1", "X3", "X5", "X6", "X7", "i4", "i5", "i7", "iX", "M3", "M5"] },
  { name: "Bentley", models: ["Bentayga", "Continental GT", "Flying Spur"] },
  { name: "Buick", models: ["Enclave", "Encore", "Envision", "Envista"] },
  { name: "Cadillac", models: ["CT4", "CT5", "Escalade", "XT4", "XT5", "XT6", "Lyriq"] },
  { name: "Chevrolet", models: ["Blazer", "Bolt", "Camaro", "Colorado", "Corvette", "Equinox", "Malibu", "Silverado", "Suburban", "Tahoe", "Trailblazer", "Traverse", "Trax"] },
  { name: "Chrysler", models: ["300", "Pacifica", "Voyager"] },
  { name: "Dodge", models: ["Challenger", "Charger", "Durango", "Hornet"] },
  { name: "Ferrari", models: ["296", "Purosangue", "Roma", "SF90", "12Cilindri"] },
  { name: "Fiat", models: ["500", "500e", "500X"] },
  { name: "Ford", models: ["Bronco", "Bronco Sport", "Edge", "Escape", "Expedition", "Explorer", "F-150", "F-250", "Maverick", "Mustang", "Mustang Mach-E", "Ranger", "Transit"] },
  { name: "Genesis", models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"] },
  { name: "GMC", models: ["Acadia", "Canyon", "Hummer EV", "Sierra", "Terrain", "Yukon"] },
  { name: "Honda", models: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Passport", "Pilot", "Prologue", "Ridgeline"] },
  { name: "Hyundai", models: ["Elantra", "Ioniq 5", "Ioniq 6", "Kona", "Palisade", "Santa Cruz", "Santa Fe", "Sonata", "Tucson", "Venue"] },
  { name: "Infiniti", models: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80"] },
  { name: "Jaguar", models: ["E-Pace", "F-Pace", "F-Type", "I-Pace", "XF"] },
  { name: "Jeep", models: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Grand Wagoneer", "Renegade", "Wagoneer", "Wrangler"] },
  { name: "Kia", models: ["Carnival", "EV6", "EV9", "Forte", "K5", "Niro", "Seltos", "Sorento", "Soul", "Sportage", "Stinger", "Telluride"] },
  { name: "Lamborghini", models: ["Huracán", "Revuelto", "Urus"] },
  { name: "Land Rover", models: ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"] },
  { name: "Lexus", models: ["ES", "GX", "IS", "LC", "LS", "LX", "NX", "RC", "RX", "RZ", "TX", "UX"] },
  { name: "Lincoln", models: ["Aviator", "Corsair", "Nautilus", "Navigator"] },
  { name: "Lucid", models: ["Air", "Gravity"] },
  { name: "Maserati", models: ["Ghibli", "Grecale", "Levante", "MC20"] },
  { name: "Mazda", models: ["CX-3", "CX-30", "CX-5", "CX-50", "CX-70", "CX-90", "Mazda3", "Mazda6", "MX-5 Miata"] },
  { name: "McLaren", models: ["750S", "Artura", "GT"] },
  { name: "Mercedes-Benz", models: ["A-Class", "C-Class", "E-Class", "S-Class", "CLA", "CLS", "G-Class", "GLA", "GLB", "GLC", "GLE", "GLS", "EQB", "EQE", "EQS", "AMG GT"] },
  { name: "Mini", models: ["Clubman", "Convertible", "Cooper", "Countryman"] },
  { name: "Mitsubishi", models: ["Eclipse Cross", "Mirage", "Outlander", "Outlander Sport"] },
  { name: "Nissan", models: ["Altima", "Ariya", "Armada", "Frontier", "GT-R", "Kicks", "Leaf", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa", "Z"] },
  { name: "Polestar", models: ["Polestar 2", "Polestar 3", "Polestar 4"] },
  { name: "Porsche", models: ["911", "718 Boxster", "718 Cayman", "Cayenne", "Macan", "Panamera", "Taycan"] },
  { name: "Ram", models: ["1500", "2500", "3500", "ProMaster"] },
  { name: "Rivian", models: ["R1S", "R1T"] },
  { name: "Rolls-Royce", models: ["Cullinan", "Ghost", "Phantom", "Spectre"] },
  { name: "Subaru", models: ["Ascent", "BRZ", "Crosstrek", "Forester", "Impreza", "Legacy", "Outback", "Solterra", "WRX"] },
  { name: "Tesla", models: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck", "Roadster"] },
  { name: "Toyota", models: ["4Runner", "bZ4X", "Camry", "Corolla", "Crown", "GR86", "GR Corolla", "GR Supra", "Highlander", "Land Cruiser", "Mirai", "Prius", "RAV4", "Sequoia", "Sienna", "Tacoma", "Tundra", "Venza"] },
  { name: "Volkswagen", models: ["Atlas", "Atlas Cross Sport", "Golf GTI", "Golf R", "ID.4", "ID.Buzz", "Jetta", "Passat", "Taos", "Tiguan"] },
  { name: "Volvo", models: ["C40", "EX30", "EX90", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"] },
];

export const CURRENT_YEAR = new Date().getFullYear();

// Newest first, going back ~35 years.
export const CAR_YEARS: number[] = Array.from(
  { length: CURRENT_YEAR - 1990 + 2 },
  (_, i) => CURRENT_YEAR + 1 - i,
);
