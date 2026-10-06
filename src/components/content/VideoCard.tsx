"use client";

import Image from "next/image";
import clsx from "clsx";
import { useState } from "react";
import { youtubeCover, youtubePlayer, type ShopVideo } from "@/lib/content";

/**
 * A YouTube video, as a still cover with a play mark. Nothing loads from YouTube and nothing
 * moves until it's tapped; then the privacy-enhanced player takes its place and plays.
 */
export function VideoCard({ video, className }: { video: ShopVideo; className?: string }) {
  const [playing, setPlaying] = useState(false);
  // A cover that can't load leaves the dark frame and the play mark, never a broken image
  const [cover, setCover] = useState(true);
  return (
    <figure className={clsx("flex flex-col gap-3", className)}>
      <div className="bg-noir relative aspect-video overflow-hidden">
        {playing ? (
          <iframe
            src={youtubePlayer(video.youtubeId)}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play: ${video.title}`}
            data-cursor="Play"
            className="group absolute inset-0 block"
          >
            {cover && (
              <Image
                src={youtubeCover(video.youtubeId)}
                alt=""
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
                onError={() => setCover(false)}
              />
            )}
            <span
              aria-hidden
              className="bg-noir/70 text-bone border-bone/50 group-hover:bg-noir/85 absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center border transition-colors md:size-20"
            >
              <svg viewBox="0 0 24 24" className="ml-1 size-6" fill="currentColor">
                <path d="M7 4.5v15l13-7.5z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="text-sm leading-snug">
        <span className="font-display block text-xl">{video.title}</span>
        {video.channel && <span className="opacity-70">{video.channel} · YouTube</span>}
      </figcaption>
    </figure>
  );
}
