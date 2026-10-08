const GUJARAT_CITIES = [
  // Gujarat — major cities
  "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar",
  "Junagadh", "Anand", "Bhuj", "Gandhidham", "Morbi", "Nadiad", "Mehsana", "Porbandar",
  "Navsari", "Valsad", "Vapi", "Bharuch", "Ankleshwar", "Surendranagar", "Palanpur",
  "Patan", "Godhra", "Dahod", "Veraval", "Amreli", "Botad", "Jetpur", "Gondal",
  "Wadhwan", "Dhoraji", "Upleta", "Mahuva", "Palitana", "Sihor", "Savarkundla",
  "Kalol", "Himatnagar", "Modasa", "Deesa", "Vijapur", "Visnagar", "Unjha", "Sidhpur",
  "Radhanpur", "Tharad", "Bhachau", "Anjar", "Mandvi", "Mundra", "Rapar",
  "Khambhat", "Petlad", "Borsad", "Anand Rural", "Umreth", "Karamsad", "Vallabh Vidyanagar",
  "Kheda", "Mahemdavad", "Balasinor", "Thasra",
  // Gujarat — Kheda / Anand / Ahmedabad district towns
  "Kapadvanj", "Kathlal", "Mahudha", "Nadiad Rural",
  "Dahegam", "Bavla", "Dholka", "Sanand", "Viramgam", "Dhandhuka", "Barwala",
  "Ranpur", "Mandal", "Detroj", "Hanspura",
  // Gujarat — Sabarkantha / Aravalli / Panchmahal / Mahisagar
  "Idar", "Khedbrahma", "Vadali", "Bayad", "Malpur", "Meghraj", "Shamlaji",
  "Lunawada", "Santrampur", "Kadana", "Halol", "Kalol (PMS)", "Shehera", "Jambughoda",
  // Gujarat — Bharuch / Narmada / Tapi / Dang
  "Jhagadia", "Amod", "Vagra", "Rajpipla", "Dediapada", "Vyara", "Songadh", "Uchchhal",
  "Ahwa", "Waghai",
  // Gujarat — Saurashtra towns
  "Dhrangadhra", "Halvad", "Muli", "Chotila", "Wankaner", "Tankara", "Maliya",
  "Keshod", "Manavadar", "Vanthali", "Kodinar", "Una", "Talala", "Sutrapada",
  "Chalala", "Damnagar", "Lathi", "Rajula", "Jafrabad",
  // Gujarat — Kutch towns
  "Nakhatrana", "Abdasa", "Lakhpat", "Bhachau Rural", "Bhirandiyara", "Khavda", "Naliya", "Dayapar", "Bhuj Rural",
  // Gujarat — Banaskantha / Patan / Mehsana extra towns
  "Dhanera", "Vadgam", "Amirgadh", "Danta", "Diyodar", "Kankrej", "Bhabhar", "Suigam", "Vav",
  "Sami", "Harij", "Chanasma", "Santalpur", "Sarasvati", "Kheralu", "Satlasana", "Becharaji", "Kadi", "Kheda (Meh)",
  "Ambaji", "Iqbalgadh",
  // Gujarat — Sabarkantha / Aravalli extra
  "Prantij", "Talod", "Poshina", "Vijaynagar", "Dhansura", "Bhiloda",
  // Gujarat — Ahmedabad district extra
  "Bagodara", "Rekhiyal", "Chaloda", "Nal Sarovar", "Vatva", "Naroda", "Bopal", "Ghatlodia", "Chandkheda",
  // Gujarat — Kheda / Anand / Mahisagar extra
  "Vaso", "Matar", "Galteshwar", "Dakor", "Sojitra", "Tarapur", "Ode", "Sarsa", "Anklav", "Khambholaj",
  "Virpur", "Khanpur",
  // Gujarat — Panchmahal / Dahod extra
  "Kalol (Panchmahal)", "Ghoghamba", "Morva Hadaf", "Devgadh Baria", "Limkheda", "Zalod", "Fatepura",
  "Sanjeli", "Garbada", "Dhanpur",
  // Gujarat — Vadodara / Chhota Udepur extra
  "Padra", "Karjan", "Savli", "Waghodia", "Dabhoi", "Sinor", "Chhota Udepur", "Kavant", "Bodeli",
  "Sankheda", "Pavi Jetpur", "Naswadi", "Tilakwada", "Garudeshwar", "Nandod",
  // Gujarat — Bharuch / Narmada / Surat extra
  "Hansot", "Valia", "Netrang", "Jambusar", "Palej", "Kim", "Kosamba", "Mangrol (Surat)",
  "Bardoli", "Mandvi (Surat)", "Vyara Rural", "Kamrej", "Olpad", "Choryasi", "Umarpada", "Mahuva (Surat)",
  // Gujarat — Tapi / Dang / Navsari / Valsad extra
  "Nizar", "Kukarmunda", "Valod", "Dolvan", "Subir", "Chikhli", "Gandevi", "Jalalpore",
  "Khergam", "Vansda", "Dharampur", "Kaprada", "Umbergaon", "Pardi", "Nargol", "Tithal",
  // Gujarat — Saurashtra extra
  "Ranavav", "Kutiyana", "Bhanvad", "Jodiya", "Kalavad", "Dhrol", "Lalpur", "Khambhalia",
  "Bhesan", "Visavadar", "Mendarda", "Malia Hatina", "Mangrol (Junagadh)", "Chorwad",
  "Ghoghavadar", "Kotda Sangani", "Jasdan", "Vinchhiya", "Paddhari", "Lodhika", "Jamkandorna",
  "Babra", "Lilia", "Bagasara", "Kunkavav", "Vadia", "Gariadhar", "Umrala", "Vallabhipur",
  "Ghogha", "Talaja", "Gadhada", "Ranpur (Botad)", "Barwala (Botad)", "Limbdi", "Sayla",
  "Chuda", "Lakhtar", "Thangadh", "Patdi", "Dasada", "Bajana", "Tikar",
];

// Union Territories (nearby, commonly used)
const UNION_TERRITORY_CITIES = ["Daman", "Diu", "Silvassa"];

// Maharashtra — district names + talukas (no villages) + a few major cities that are not talukas.
// Source for districts/talukas: Wikipedia, "List of talukas of Maharashtra" (rev. 1357899042; cites
// maharashtra.gov.in). Names as spelled there. A name shared with another place is bracketed with its
// district, like "Mandvi (Surat)". Renamed districts show the current official name with the old one in
// brackets so a search for either finds them.
const MAHARASHTRA_CITIES = [
  // Sindhudurg
  "Sindhudurg", "Kankavli", "Vaibhavwadi", "Devgad", "Malwan", "Sawantwadi", "Kudal", "Vengurla", "Dodamarg",
  // Ratnagiri
  "Ratnagiri", "Sangameshwar", "Lanja", "Rajapur", "Chiplun", "Guhagar", "Dapoli", "Mandangad", "Khed (Ratnagiri)",
  // Raigad
  "Raigad", "Pen", "Alibag", "Murud", "Panvel", "Uran", "Karjat (Raigad)", "Khalapur", "Mangaon", "Tala", "Roha", "Sudhagad-Pali", "Mahad", "Poladpur", "Shrivardhan", "Mhasala",
  // Mumbai
  "Mumbai", "Kurla", "Andheri", "Borivali",
  // Thane
  "Thane", "Kalyan", "Murbad", "Shahapur", "Bhiwandi", "Ulhasnagar", "Ambarnath",
  // Palghar
  "Palghar", "Vasai", "Dahanu", "Talasari", "Jawhar", "Mokhada", "Vada", "Vikramgad",
  // Nashik
  "Nashik", "Igatpuri", "Dindori", "Peth", "Trimbakeshwar", "Kalwan", "Deola", "Surgana", "Baglan", "Malegaon (Nashik)", "Nandgaon", "Chandwad", "Niphad", "Sinnar", "Yeola",
  // Nandurbar
  "Nandurbar", "Navapur", "Shahada", "Talode", "Akkalkuwa", "Dhadgaon",
  // Dhule
  "Dhule", "Sakri", "Sindkheda", "Shirpur",
  // Jalgaon
  "Jalgaon", "Jamner", "Erandol", "Dharangaon", "Bhusawal", "Raver", "Muktainagar", "Bodwad", "Yawal", "Amalner", "Parola", "Chopda", "Pachora", "Bhadgaon", "Chalisgaon",
  // Buldhana
  "Buldhana", "Chikhli (Buldhana)", "Deulgaon Raja", "Jalgaon Jamod", "Sangrampur", "Malkapur", "Motala", "Nandura", "Khamgaon", "Shegaon", "Mehkar", "Sindkhed Raja", "Lonar",
  // Akola
  "Akola", "Akot", "Telhara", "Balapur", "Patur", "Murtajapur", "Barshitakli",
  // Washim
  "Washim", "Malegaon (Washim)", "Risod", "Mangrulpir", "Karanja (Washim)", "Manora",
  // Amravati
  "Amravati", "Bhatkuli", "Nandgaon Khandeshwar", "Dharni", "Chikhaldara", "Achalpur", "Chandurbazar", "Morshi", "Warud", "Daryapur", "Anjangaon-Surji", "Chandur", "Dhamangaon", "Tiosa",
  // Wardha
  "Wardha", "Deoli", "Seloo", "Arvi", "Ashti (Wardha)", "Karanja (Wardha)", "Hinganghat", "Samudrapur",
  // Nagpur
  "Nagpur", "Nagpur Rural", "Kamptee", "Hingna", "Katol", "Narkhed", "Savner", "Kalameshwar", "Ramtek", "Mouda", "Parseoni", "Umred", "Kuhi", "Bhiwapur",
  // Bhandara
  "Bhandara", "Tumsar", "Pauni", "Mohadi", "Sakoli", "Lakhani", "Lakhandur",
  // Gondia
  "Gondia", "Goregaon", "Salekasa", "Tiroda", "Amgaon", "Deori", "Arjuni-Morgaon", "Sadak-Arjuni",
  // Gadchiroli
  "Gadchiroli", "Dhanora", "Chamorshi", "Mulchera", "Desaiganj", "Armori", "Kurkheda", "Korchi", "Aheri", "Etapalli", "Bhamragad", "Sironcha",
  // Chandrapur
  "Chandrapur", "Saoli", "Mul", "Ballarpur", "Pombhurna", "Gondpimpri", "Warora", "Chimur", "Bhadravati", "Bramhapuri", "Nagbhid", "Sindewahi", "Rajura", "Korpana", "Jiwati",
  // Yavatmal
  "Yavatmal", "Arni", "Babhulgaon", "Kalamb (Yavatmal)", "Darwha", "Digras", "Ner", "Pusad", "Umarkhed", "Mahagaon", "Kelapur", "Ralegaon", "Ghatanji", "Wani", "Maregaon", "Zari Jamani",
  // Nanded
  "Nanded", "Ardhapur", "Mudkhed", "Bhokar", "Umri", "Loha", "Kandhar", "Kinwat", "Himayatnagar", "Hadgaon", "Mahur", "Deglur", "Mukhed", "Dharmabad", "Biloli", "Naigaon",
  // Hingoli
  "Hingoli", "Sengaon", "Kalamnuri", "Basmath", "Aundha Nagnath",
  // Parbhani
  "Parbhani", "Sonpeth", "Gangakhed", "Palam", "Purna", "Sailu", "Jintur", "Manwath", "Pathri",
  // Jalna
  "Jalna", "Bhokardan", "Jafrabad (Jalna)", "Badnapur", "Ambad", "Ghansawangi", "Partur", "Mantha",
  // Aurangabad
  "Chhatrapati Sambhajinagar (Aurangabad)", "Kannad", "Soegaon", "Sillod", "Phulambri", "Khuldabad", "Vaijapur", "Gangapur", "Paithan",
  // Beed
  "Beed", "Georai", "Patoda", "Shirur-Kasar", "Ashti (Beed)", "Majalgaon", "Wadwani", "Kaij", "Dharur", "Parli", "Ambajogai",
  // Latur
  "Latur", "Renapur", "Ausa", "Ahmedpur", "Jalkot", "Chakur", "Shirur Anantpal", "Nilanga", "Deoni", "Udgir",
  // Osmanabad
  "Dharashiv (Osmanabad)", "Tuljapur", "Bhum", "Paranda", "Washi", "Kalamb (Dharashiv)", "Lohara", "Umarga",
  // Solapur
  "Solapur", "Barshi", "Solapur North", "Solapur South", "Akkalkot", "Madha", "Karmala", "Pandharpur", "Mohol", "Malshiras", "Sangole", "Mangalvedhe",
  // Ahmednagar
  "Ahilyanagar (Ahmednagar)", "Shevgaon", "Pathardi", "Parner", "Sangamner", "Kopargaon", "Akole", "Shrirampur", "Nevasa", "Rahata", "Rahuri", "Shrigonda", "Karjat (Ahilyanagar)", "Jamkhed",
  // Pune
  "Pune", "Haveli", "Khed (Pune)", "Junnar", "Ambegaon", "Maval", "Mulshi", "Shirur", "Purandhar", "Velhe", "Bhor", "Baramati", "Indapur", "Daund",
  // Satara
  "Satara", "Jaoli", "Koregaon", "Wai", "Mahabaleshwar", "Khandala", "Phaltan", "Maan", "Khatav", "Patan (Satara)", "Karad",
  // Sangli
  "Sangli", "Miraj", "Kavathemahankal", "Tasgaon", "Jat", "Walwa", "Shirala", "Khanapur", "Atpadi", "Palus", "Kadegaon",
  // Kolhapur
  "Kolhapur", "Karvir", "Panhala", "Shahuwadi", "Kagal", "Hatkanangale", "Shirol", "Radhanagari", "Gaganbawada", "Bhudargad", "Gadhinglaj", "Chandgad", "Ajra",
  // Other major cities (not talukas)
  "Navi Mumbai", "Dombivli", "Mira-Bhayandar", "Virar", "Pimpri-Chinchwad", "Ichalkaranji", "Lonavala", "Shirdi",
];

export interface CityGroup {
  state: string;
  cities: string[];
}

export const CITIES_BY_STATE: CityGroup[] = [
  { state: "Gujarat", cities: [...GUJARAT_CITIES].sort() },
  { state: "Maharashtra", cities: [...MAHARASHTRA_CITIES].sort() },
  { state: "Union Territories", cities: [...UNION_TERRITORY_CITIES].sort() },
];

// Flat list across all states, kept for existing consumers (useCity, CitySelector.detect).
export const INDIAN_CITIES: string[] = CITIES_BY_STATE.flatMap((g) => g.cities).sort();
