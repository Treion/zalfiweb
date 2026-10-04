-- White Oud (Oudor) and Precious Woods (Bond) have no photo: they leave the pyramids, and the library when nothing else uses them.
DELETE FROM "fragrance_notes" WHERE "note_id" IN (SELECT "id" FROM "notes" WHERE "slug" IN ('white-oud', 'precious-woods'));
--> statement-breakpoint
DELETE FROM "notes" WHERE "slug" IN ('white-oud', 'precious-woods') AND "id" NOT IN (SELECT "note_id" FROM "fragrance_notes");
--> statement-breakpoint
-- Alt text for the owner's mint, apple and sandalwood photos, only where it is still the original
UPDATE "notes" SET "alt" = 'A cluster of fresh spearmint leaves' WHERE "slug" = 'mint' AND "alt" = 'A fresh sprig of spearmint leaves';
--> statement-breakpoint
UPDATE "notes" SET "alt" = 'A red apple beside a cut half' WHERE "slug" = 'apple' AND "alt" = 'A red-blushed yellow apple';
--> statement-breakpoint
UPDATE "notes" SET "alt" = 'Sandalwood sticks with a scoop of its powder and green leaves' WHERE "slug" = 'sandalwood' AND "alt" IN ('Sandalwood sticks with green leaves', 'Pale gold sandalwood sticks and chips');
