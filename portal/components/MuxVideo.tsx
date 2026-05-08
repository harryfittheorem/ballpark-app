"use client";

import MuxPlayer from "@mux/mux-player-react";

type CommonProps = {
  title?: string;
  accentColor?: string;
};

type Props =
  | (CommonProps & { playbackId: string; src?: never })
  | (CommonProps & { src: string; playbackId?: never });

export function MuxVideo(props: Props) {
  const { title, accentColor = "#0ea5e9" } = props;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-black">
      <MuxPlayer
        {...("playbackId" in props && props.playbackId
          ? { playbackId: props.playbackId }
          : { src: (props as { src: string }).src })}
        metadata={title ? { video_title: title } : undefined}
        streamType="on-demand"
        autoPlay={false}
        accentColor={accentColor}
        style={{ aspectRatio: "16 / 9", width: "100%" }}
      />
    </div>
  );
}
