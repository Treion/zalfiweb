import clsx from "clsx";

/**
 * A tasteful stand-in for an image that has not been supplied yet. It shows a hairline frame,
 * corner ticks, and the exact filename the owner needs to add. It is never a fake or cartoon image.
 */
export function AssetFrame({
  filename,
  label,
  className,
}: {
  filename: string;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label ? `${label} (image coming soon)` : "Image coming soon"}
      className={clsx(
        "relative flex aspect-square w-full items-center justify-center border border-current/20 text-current",
        className,
      )}
    >
      {(
        [
          "top-0 left-0",
          "top-0 right-0 rotate-90",
          "right-0 bottom-0 rotate-180",
          "bottom-0 left-0 -rotate-90",
        ] as const
      ).map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={clsx("absolute size-3 border-t border-l border-current/60", pos)}
        />
      ))}
      <div className="flex flex-col items-center gap-2 px-3 text-center">
        {label && <span className="display-italic text-lg leading-none opacity-80">{label}</span>}
        <span className="font-mono text-[10px] tracking-wide opacity-50">{filename}</span>
      </div>
    </div>
  );
}
