import { Eye, FileVideo, MapPin, Monitor, ShoppingBag, UserPlus, Users } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { AmbientCover } from '../../../components/AmbientCover'
import { QRCodeWithAvatar } from '../../../components/QRCodeWithAvatar'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { DouyinLikeIcon } from '../../components/Icons'
import type { DouyinLiveData } from './types'

const coverMaskStyle: React.CSSProperties = {
  maskImage: 'linear-gradient(to bottom, transparent 0%, black 0, black 28%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 0, black 28%, transparent 100%)'
}

/**
 * 全局氛围背景层：模糊封面 + 渐变遮罩 + 高对比杂色纹理
 */
const AmbientBackground: React.FC<{ pic: string; ctx: PosterProps<DouyinLiveData>['ctx'] }> = React.memo(({ pic, ctx }) => (
  <div className="absolute inset-0 overflow-hidden -z-10">
    <AmbientCover src={pic} ctx={ctx} />
    <div className="absolute inset-0 pointer-events-none opacity-[0.45] mix-blend-overlay dark:mix-blend-soft-light">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="douyinNoise">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
            <feComponentTransfer>
              <feFuncA type="linear" slope="2.5" intercept="-0.6" />
            </feComponentTransfer>
          </filter>
          <mask id="noiseMask">
            <linearGradient id="noiseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.85" />
              <stop offset="25%" stopColor="white" stopOpacity="0.4" />
              <stop offset="50%" stopColor="white" stopOpacity="0.08" />
              <stop offset="75%" stopColor="white" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0.85" />
            </linearGradient>
            <rect width="100%" height="100%" fill="url(#noiseGradient)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" filter="url(#douyinNoise)" mask="url(#noiseMask)" fill="white" />
      </svg>
    </div>
  </div>
))

AmbientBackground.displayName = 'AmbientBackground'

/**
 * 封面组件 - 全宽铺满 + 双向渐变溶解 + LIVE大字
 */
const CoverSection: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  return (
    <div className="relative">
      <div style={coverMaskStyle}>
        <img className="object-cover w-full" src={imageUrl} alt="直播封面" />
      </div>
      <div className="absolute right-20 top-20 pointer-events-none select-none">
        <span className="text-7xl font-black tracking-[0.15em] uppercase text-white/20">直播中</span>
      </div>
    </div>
  )
}

/**
 * 直播信息组件
 */
const InfoSection: React.FC<{ data: DouyinLiveData }> = ({ data }) => {
  return (
    <div className="flex flex-col gap-8 px-16 pt-12">
      {/* 直播标题 - 视觉锚点 */}
      <h1 className="text-[80px] font-black leading-tight text-foreground tracking-tight select-text">{data.text}</h1>

      {/* 直播中 + 分区 + 房间号 */}
      <div className="flex items-center gap-4 text-3xl text-foreground/30">
        <span className="text-danger/60 font-black tracking-wider text-[32px]">直播中</span>
        <span>/</span>
        <span>{data.partition_title}</span>
        <span>/</span>
        <span>房间号 {data.room_id}</span>
      </div>

      {/* 直播数据 */}
      <div className="flex flex-wrap items-center gap-6 text-3xl text-foreground/30">
        <span className="flex items-center gap-1.5">
          <Users size={28} className="text-foreground/20" />
          {data.online_viewers}在线
        </span>
        <span className="flex items-center gap-1.5">
          <Eye size={28} className="text-foreground/20" />
          {data.total_viewers}观看
        </span>
        <span className="flex items-center gap-1.5">
          <DouyinLikeIcon size={28} />
          {data.like_count}点赞
        </span>
        {data.resolution && (
          <span className="flex items-center gap-1.5">
            <Monitor size={28} className="text-foreground/20" />
            {data.resolution}
          </span>
        )}
        {data.has_commerce_goods && (
          <span className="flex items-center gap-1.5">
            <ShoppingBag size={28} className="text-foreground/20" />
            带货中
          </span>
        )}
      </div>

      {/* 签名 */}
      {data.signature && <div className="text-5xl leading-relaxed text-foreground/75 select-text">{data.signature}</div>}

      {/* 城市 */}
      {data.city && (
        <div className="flex items-center gap-2 text-3xl text-foreground/30">
          <MapPin size={28} className="text-foreground/20" />
          <span>{data.city}</span>
        </div>
      )}
    </div>
  )
}

/**
 * 底部区域 - 主播信息 + 二维码 + 抖音Logo
 */
const BottomSection: React.FC<PosterProps<DouyinLiveData>> = ({ data, ctx }) => {
  return (
    <div className="flex justify-between items-end px-16 pt-24 pb-16">
      {/* 左侧：主播信息 */}
      <div className="flex flex-col gap-10">
        <div className="flex gap-10 items-center">
          <div className="relative shrink-0">
            <div className="flex justify-center items-center bg-white rounded-full w-35 h-35">
              <img src={data.avater_url} alt="头像" className="rounded-full w-33 h-33" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-7xl font-bold text-foreground select-text">@{data.username}</div>
            <div className="flex items-center gap-3 text-4xl text-foreground/50">
              <span className="text-foreground/50 font-black tracking-wider text-3xl">直播中</span>
              <span className="text-foreground/40">·</span>
              <Users size={32} />
              <span className="select-text">{data.fans}粉丝</span>
            </div>
          </div>
        </div>

        <div className="flex gap-6 text-3xl text-foreground/70">
          <div className="flex flex-col gap-2 px-6 py-3 rounded-2xl bg-default/45">
            <div className="flex items-center gap-2">
              <FileVideo size={28} />
              <span className="text-foreground/40">作品</span>
            </div>
            <span className="font-medium text-4xl select-text">{data.aweme_count}</span>
          </div>
          <div className="flex flex-col gap-2 px-6 py-3 rounded-2xl bg-default/45">
            <div className="flex items-center gap-2">
              <UserPlus size={28} />
              <span className="text-foreground/40">关注</span>
            </div>
            <span className="font-medium text-4xl select-text">{data.following_count}</span>
          </div>
          <div className="flex flex-col gap-2 px-6 py-3 rounded-2xl bg-default/45">
            <div className="flex items-center gap-2">
              <DouyinLikeIcon size={28} />
              <span className="text-foreground/40">获赞</span>
            </div>
            <span className="font-medium text-4xl select-text">{data.total_favorited}</span>
          </div>
        </div>
      </div>

      {/* 右侧：抖音Logo + 二维码 */}
      <div className="flex flex-col items-end gap-6">
        <img
          src={isDarkMode(ctx) ? '/image/douyin/dylogo-light.svg' : '/image/douyin/dylogo-dark.svg'}
          alt="抖音"
          className="w-60 h-auto opacity-80 dark:opacity-70"
        />
        {data.share_url ? (
          <QRCodeWithAvatar
            value={data.share_url}
            avatarUrl={data.avater_url}
            useDarkTheme={isDarkMode(ctx)}
            alt="二维码"
            className="h-auto w-75"
          />
        ) : (
          <div className="flex justify-center items-center bg-surface w-75 h-75">
            <span className="text-foreground/50">二维码</span>
          </div>
        )}
        <span className="text-2xl text-foreground/50 select-text">扫码进入直播间</span>
      </div>
    </div>
  )
}

/**
 * 抖音直播组件
 */
export const DouyinLive: React.FC<PosterProps<DouyinLiveData>> = (props) => {
  const d = props.data
  const { ctx } = props

  return (
    <DefaultLayout ctx={props.ctx} className="relative overflow-hidden">
      <AmbientBackground pic={d.image_url} ctx={ctx} />

      <div className="relative z-10">
        <CoverSection imageUrl={d.image_url} />
        <InfoSection data={d} />
        <BottomSection data={d} ctx={ctx} />
      </div>
    </DefaultLayout>
  )
}

export default DouyinLive
