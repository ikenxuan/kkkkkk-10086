import React from 'react'

type PreviewVideoCardProps = {
  videoUrl: string
}

export const PreviewVideoCard: React.FC<PreviewVideoCardProps> = ({ videoUrl }) => {
  return (
    <div className="relative z-10 mt-10 w-full">
      <video
        className="w-full max-h-[86vh] rounded-2xl bg-black shadow-2xl"
        controls
        preload="metadata"
        autoPlay
        loop
        muted
        playsInline
        src={videoUrl}
      />
    </div>
  )
}
