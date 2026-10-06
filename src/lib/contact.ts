/** How to reach ZALFI. One source for the footer, the contact page and structured data. */
export const CONTACT = {
  phone: "+8801810524672",
  phoneDisplay: "+880 1810-524672",
  email: "zalfi.elixir@gmail.com",
  address: ["104/1, Nasir Uddin Tower", "Kakrail, Dhaka 1214", "Bangladesh"],
  facebook: "https://www.facebook.com/ZALFI.BD",
  instagram: "https://www.instagram.com/zalfi.bd/",
} as const;

export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  CONTACT.address.join(", "),
)}`;

/** A WhatsApp chat with the house, optionally with a first message written for the customer */
export const whatsappUrl = (text?: string) =>
  `https://wa.me/${CONTACT.phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
