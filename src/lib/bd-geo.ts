/**
 * Bangladesh delivery geography: the 64 districts, and Dhaka district's areas.
 * "Inside Dhaka" (the lower shipping fee) is decided by Settings → Shipping, whose default list is
 * DHAKA_CITY_THANAS. Other districts take a free-text area (see docs/DECISIONS.md).
 */

export const DISTRICTS = [
  // Dhaka division
  "Dhaka",
  "Faridpur",
  "Gazipur",
  "Gopalganj",
  "Kishoreganj",
  "Madaripur",
  "Manikganj",
  "Munshiganj",
  "Narayanganj",
  "Narsingdi",
  "Rajbari",
  "Shariatpur",
  "Tangail",
  // Chattogram division
  "Bandarban",
  "Brahmanbaria",
  "Chandpur",
  "Chattogram",
  "Cox's Bazar",
  "Cumilla",
  "Feni",
  "Khagrachhari",
  "Lakshmipur",
  "Noakhali",
  "Rangamati",
  // Rajshahi division
  "Bogura",
  "Chapainawabganj",
  "Joypurhat",
  "Naogaon",
  "Natore",
  "Pabna",
  "Rajshahi",
  "Sirajganj",
  // Khulna division
  "Bagerhat",
  "Chuadanga",
  "Jashore",
  "Jhenaidah",
  "Khulna",
  "Kushtia",
  "Magura",
  "Meherpur",
  "Narail",
  "Satkhira",
  // Barishal division
  "Barguna",
  "Barishal",
  "Bhola",
  "Jhalokathi",
  "Patuakhali",
  "Pirojpur",
  // Sylhet division
  "Habiganj",
  "Moulvibazar",
  "Sunamganj",
  "Sylhet",
  // Rangpur division
  "Dinajpur",
  "Gaibandha",
  "Kurigram",
  "Lalmonirhat",
  "Nilphamari",
  "Panchagarh",
  "Rangpur",
  "Thakurgaon",
  // Mymensingh division
  "Jamalpur",
  "Mymensingh",
  "Netrokona",
  "Sherpur",
] as const;

export type District = (typeof DISTRICTS)[number];

/** Dhaka Metropolitan Police thanas: the default "Inside Dhaka" list (editable in Settings) */
export const DHAKA_CITY_THANAS = [
  "Adabor",
  "Badda",
  "Banani",
  "Bangshal",
  "Bhashantek",
  "Bimanbandar",
  "Cantonment",
  "Chawkbazar",
  "Dakshinkhan",
  "Darus Salam",
  "Demra",
  "Dhanmondi",
  "Gendaria",
  "Gulshan",
  "Hatirjheel",
  "Hazaribagh",
  "Jatrabari",
  "Kadamtali",
  "Kafrul",
  "Kalabagan",
  "Kamrangirchar",
  "Khilgaon",
  "Khilkhet",
  "Kotwali",
  "Lalbagh",
  "Mirpur",
  "Mohammadpur",
  "Motijheel",
  "Mugda",
  "New Market",
  "Pallabi",
  "Paltan",
  "Ramna",
  "Rampura",
  "Rupnagar",
  "Sabujbagh",
  "Shah Ali",
  "Shahbagh",
  "Shahjahanpur",
  "Sher-e-Bangla Nagar",
  "Shyampur",
  "Sutrapur",
  "Tejgaon",
  "Tejgaon Industrial Area",
  "Turag",
  "Uttara East",
  "Uttara West",
  "Uttarkhan",
  "Vatara",
  "Wari",
] as const;

/** Dhaka district's upazilas outside the city (they pay the outside-Dhaka fee by default) */
export const DHAKA_DISTRICT_UPAZILAS = ["Dhamrai", "Dohar", "Keraniganj", "Nawabganj", "Savar"];

/** Area choices for Dhaka district: the city thanas, then the upazilas around it */
export const DHAKA_AREAS = [...DHAKA_CITY_THANAS, ...DHAKA_DISTRICT_UPAZILAS];

export const isDistrict = (v: string): v is District =>
  (DISTRICTS as readonly string[]).includes(v);
