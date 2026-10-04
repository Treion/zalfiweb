-- 0006 compared the launch colours exactly, but the admin saves colours in lower case, so a
-- fragrance saved there kept its light world. Same rule, any case: a palette still holding its
-- launch colours moves to its dusk; one the owner has recoloured stays as it is.
UPDATE "fragrances" SET "palette" = '{"bg":"#2C213C","deep":"#160F22","accent":"#AEDDCB","ink":"#EDE9F6"}'::jsonb
  WHERE "slug" = 'reva'
    AND lower("palette"->>'bg') = '#dcd8e8' AND lower("palette"->>'deep') = '#5e6b4a'
    AND lower("palette"->>'accent') = '#cfe3d8' AND lower("palette"->>'ink') = '#1f2420';--> statement-breakpoint
UPDATE "fragrances" SET "palette" = '{"bg":"#102E22","deep":"#041811","accent":"#C8DE63","ink":"#E2F1E8"}'::jsonb
  WHERE "slug" = 'riven'
    AND lower("palette"->>'bg') = '#e3eee9' AND lower("palette"->>'deep') = '#1e2b24'
    AND lower("palette"->>'accent') = '#c7d95a' AND lower("palette"->>'ink') = '#12201a';--> statement-breakpoint
UPDATE "fragrances" SET "palette" = '{"bg":"#112C34","deep":"#04171D","accent":"#9DC9BC","ink":"#F1EDE2"}'::jsonb
  WHERE "slug" = 'maree'
    AND lower("palette"->>'bg') = '#f1eee6' AND lower("palette"->>'deep') = '#22302c'
    AND lower("palette"->>'accent') = '#9db8ae' AND lower("palette"->>'ink') = '#1a2220';--> statement-breakpoint
UPDATE "fragrances" SET "palette" = '{"bg":"#3A2511","deep":"#211003","accent":"#E9BE57","ink":"#F6EBD8"}'::jsonb
  WHERE "slug" = 'solea'
    AND lower("palette"->>'bg') = '#f4ead8' AND lower("palette"->>'deep') = '#5a3a22'
    AND lower("palette"->>'accent') = '#e3b64b' AND lower("palette"->>'ink') = '#2b1d12';
