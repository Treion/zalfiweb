-- The worlds move into one tonal family: every chapter is a deep dusk in its own hue, with light
-- ink, so scrolling through the fragrances never flashes between light and dark rooms. Bond and
-- Oudor were already there. Only palettes still at their launch colours change: a world the owner
-- has recoloured in the admin is left as it is.
UPDATE "fragrances" SET "palette" = '{"bg":"#2C213C","deep":"#160F22","accent":"#AEDDCB","ink":"#EDE9F6"}'::jsonb
  WHERE "slug" = 'reva' AND "palette" = '{"bg":"#DCD8E8","deep":"#5E6B4A","accent":"#CFE3D8","ink":"#1F2420"}'::jsonb;--> statement-breakpoint
UPDATE "fragrances" SET "palette" = '{"bg":"#102E22","deep":"#041811","accent":"#C8DE63","ink":"#E2F1E8"}'::jsonb
  WHERE "slug" = 'riven' AND "palette" = '{"bg":"#E3EEE9","deep":"#1E2B24","accent":"#C7D95A","ink":"#12201A"}'::jsonb;--> statement-breakpoint
UPDATE "fragrances" SET "palette" = '{"bg":"#112C34","deep":"#04171D","accent":"#9DC9BC","ink":"#F1EDE2"}'::jsonb
  WHERE "slug" = 'maree' AND "palette" = '{"bg":"#F1EEE6","deep":"#22302C","accent":"#9DB8AE","ink":"#1A2220"}'::jsonb;--> statement-breakpoint
UPDATE "fragrances" SET "palette" = '{"bg":"#3A2511","deep":"#211003","accent":"#E9BE57","ink":"#F6EBD8"}'::jsonb
  WHERE "slug" = 'solea' AND "palette" = '{"bg":"#F4EAD8","deep":"#5A3A22","accent":"#E3B64B","ink":"#2B1D12"}'::jsonb;
