/** A fragrance as the "Recently viewed" rail shows it */
export type ViewedItem = {
  slug: string;
  name: string;
  mood: string;
  pricePoisha: number | null;
  image: string;
};

/** The slim list the rail needs, from the full catalogue (server side) */
export const viewedItems = (
  fragrances: {
    slug: string;
    name: string;
    mood: string;
    bottleImage: string;
    variants: { pricePoisha: number }[];
  }[],
): ViewedItem[] =>
  fragrances.map((f) => ({
    slug: f.slug,
    name: f.name,
    mood: f.mood,
    pricePoisha: f.variants[0]?.pricePoisha ?? null,
    image: f.bottleImage,
  }));
