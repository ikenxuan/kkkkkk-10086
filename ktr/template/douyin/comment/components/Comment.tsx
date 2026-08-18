import { createRichTextDocument, renderRichTextToReact } from '@kkk/richtext'
import { PlayIcon } from '@phosphor-icons/react'
import { differenceInSeconds, format, formatDistanceToNow, fromUnixTime } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Search } from 'lucide-react'
import React, { type ReactNode } from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { QRCodeWithAvatar } from '../../../components/QRCodeWithAvatar'
import type { PosterProps } from '../../../types/ctx'
import { cn } from '../../../../utils/cn'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { DouyinCommentIcon, DouyinFavoriteIcon, DouyinLikeIcon, DouyinMoreIcon, DouyinShareIcon } from '../../components/Icons'
import type { DouyinSubComment } from '../../components/types'
import type { DouyinCommentData } from './types'

type DouyinVideoInfoHeaderProps = Omit<DouyinCommentData, 'CommentsData'> & { useDarkTheme: boolean }

const douyinMentionClassName = 'text-[#04498d] dark:text-[#face15]'
const douyinSearchKeywordClassName = 'font-medium text-[#04498d] dark:text-[#face15]'
const douyinSearchKeywordIconClassName = 'opacity-90'
// 注意不能提升到模块顶层调用：打包后注册表与共享 chunk 存在循环引用，
// 模块求值期调用会在「未初始化」的绑定上炸出 is not a function，必须惰性创建。
const createEmptyDouyinRichText = () => createRichTextDocument([], { platform: 'douyin' })

const renderDouyinCommentRichText = (content: DouyinSubComment['text'] | DouyinCommentData['CommentsData'][number]['text']): ReactNode => {
  return renderRichTextToReact(content, {
    mention: { className: douyinMentionClassName },
    searchKeyword: { className: douyinSearchKeywordClassName, iconClassName: douyinSearchKeywordIconClassName }
  })
}

const formatDouyinCommentTime = (timestamp: number): string => {
  if (!timestamp) {
    return ''
  }

  const commentDate = fromUnixTime(timestamp)
  const diffSeconds = differenceInSeconds(new Date(), commentDate)

  if (diffSeconds < 30) {
    return '刚刚'
  }

  if (diffSeconds < 7776000) {
    return formatDistanceToNow(commentDate, {
      locale: zhCN,
      addSuffix: true
    })
  }

  return format(commentDate, 'yyyy-MM-dd')
}

const formatDouyinCommentDiggCount = (count: number): string => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}w`
  }

  return String(count)
}

const formatPublishTime = (timestamp: number): string => {
  if (!timestamp) return ''
  return format(fromUnixTime(timestamp), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })
}

// const DouyinLogo: React.FC<{ useDarkTheme?: boolean }> = ({ useDarkTheme }) => {
//   const [hasError, setHasError] = React.useState(false)

//   if (hasError) {
//     return (
//       <div className='flex items-center h-full text-6xl font-bold text-foreground/70'>
//         抖音
//       </div>
//     )
//   }

//   return (
//     <img
//       src={useDarkTheme ? '/image/douyin/dylogo-light.svg' : '/image/douyin/dylogo-dark.svg'}
//       alt='抖音Logo'
//       className='object-contain h-full w-auto max-w-125'
//       onError={() => setHasError(true)}
//     />
//   )
// }

/**
 * 二维码组件
 * @param props 组件属性
 * @returns JSX元素
 */
const QRCodeSection: React.FC<DouyinVideoInfoHeaderProps> = (props) => {
  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-center items-center w-100 h-100 p-4">
        <QRCodeWithAvatar
          value={props.share_url}
          avatarUrl={props.AuthorAvatar}
          useDarkTheme={props.useDarkTheme}
          alt="二维码"
          className="object-contain w-full h-full rounded-lg"
        />
      </div>
    </div>
  )
}

/**
 * 视频信息头部组件
 * @param props 组件属性
 * @returns JSX元素
 */
const VideoInfoHeader: React.FC<DouyinVideoInfoHeaderProps> = (props) => {
  return (
    <div className="max-w-350 mx-auto px-10 pt-14">
      <div className="flex items-start justify-between gap-10">
        {/* 左侧内容区 */}
        <div className="flex flex-col gap-10 flex-1 min-w-0">
          {/* 作者信息 + Logo */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-6 min-w-0">
              {/* 作者头像 */}
              <div className="w-35 h-35 shrink-0 rounded-full overflow-hidden bg-surface-secondary ring-2 ring-border/40">
                <img src={props.AuthorAvatar} className="w-full h-full object-cover" alt={props.Author} />
              </div>
              {/* 作者名 + 时间 */}
              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-5xl font-medium text-foreground truncate">{props.Author}</span>
                </div>
                <span className="text-4xl text-muted">{formatPublishTime(props.CreateTime)}</span>
              </div>
            </div>

            {/* 抖音 Logo */}
            {/* <div className='h-28 flex items-center shrink-0'>
              <DouyinLogo useDarkTheme={props.useDarkTheme} />
            </div> */}
          </div>

          {/* 数据统计 */}
          <div className="grid grid-cols-2 gap-8">
            <div className="flex items-center gap-4 text-foreground/50">
              <DouyinLikeIcon size={48} />
              <span className="text-5xl font-medium text-foreground/90">{formatDouyinCommentDiggCount(props.Statistics.digg_count)}</span>
            </div>
            <div className="flex items-center gap-4 text-foreground/50">
              <DouyinCommentIcon size={48} />
              <span className="text-5xl font-medium text-foreground/90">
                {formatDouyinCommentDiggCount(props.Statistics.comment_count)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-foreground/50">
              <DouyinShareIcon size={48} />
              <span className="text-5xl font-medium text-foreground/90">{formatDouyinCommentDiggCount(props.Statistics.share_count)}</span>
            </div>
            <div className="flex items-center gap-4 text-foreground/50">
              <DouyinFavoriteIcon size={48} />
              <span className="text-5xl font-medium text-foreground/90">
                {formatDouyinCommentDiggCount(props.Statistics.collect_count)}
              </span>
            </div>
          </div>

          {/* 规格信息 */}
          <div className="flex items-center gap-4 flex-wrap text-muted">
            <span className="text-4xl">{props.Type}</span>
            {props.Type === '视频' && props.Resolution && (
              <>
                <span className="text-4xl text-border">·</span>
                <span className="text-4xl">{props.Resolution}</span>
              </>
            )}
            {props.Type === '视频' ? (
              <>
                <span className="text-4xl text-border">·</span>
                <span className="text-4xl">{props.VideoSize}MB</span>
                <span className="text-4xl text-border">·</span>
                <span className="text-4xl">{props.VideoFPS}Hz</span>
              </>
            ) : (
              <>
                <span className="text-4xl text-border">·</span>
                <span className="text-4xl">{props.Region}</span>
                <span className="text-4xl text-border">·</span>
                <span className="text-4xl">{props.ImageLength}张</span>
              </>
            )}
          </div>
        </div>

        {/* 右侧二维码 */}
        <div className="shrink-0">
          <QRCodeSection {...props} />
        </div>
      </div>
    </div>
  )
}

interface ReplyNode extends DouyinSubComment {
  children: ReplyNode[]
  hiddenCount?: number
}

const organizeReplies = (replies: DouyinSubComment[], rootCid: string, maxDepth: number = 6): ReplyNode[] => {
  const map = new Map<string, ReplyNode>()
  const roots: ReplyNode[] = []

  // 第一遍：创建节点
  replies.forEach((r) => {
    map.set(r.cid, { ...r, children: [] })
  })

  // 第二遍：构建树
  replies.forEach((r) => {
    const node = map.get(r.cid)!
    const parentId = r.reply_to_reply_id
    if (parentId && map.has(parentId) && parentId !== rootCid && parentId !== '0') {
      map.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // 计算深度并修剪树的函数
  const pruneTree = (nodes: ReplyNode[], currentDepth: number): ReplyNode[] => {
    if (currentDepth > maxDepth) {
      const count = nodes.length + nodes.reduce((acc, node) => acc + countChildren(node), 0)
      if (count > 0) {
        return [
          {
            cid: `more-${Date.now()}-${Math.random()}`,
            text: createEmptyDouyinRichText(),
            digg_count: 0,
            create_time: 0,
            nickname: '',
            userimageurl: '',
            ip_label: '',
            text_extra: [],
            label_text: '',
            image_list: null,
            reply_to_reply_id: '',
            reply_to_username: '',
            children: [],
            hiddenCount: count
          }
        ]
      }
      return []
    }

    return nodes.map((node) => {
      node.children = pruneTree(node.children, currentDepth + 1)
      return node
    })
  }

  const countChildren = (node: ReplyNode): number => {
    return node.children.length + node.children.reduce((acc, child) => acc + countChildren(child), 0)
  }

  return pruneTree(roots, 1)
}

const ReplyItemComponent: React.FC<{ reply: ReplyNode; depth?: number; isLast?: boolean; maxDepth?: number }> = ({
  reply,
  depth = 0,
  isLast,
  maxDepth = 6
}) => {
  const nicknameLength = reply.nickname.length
  const replyToLength = reply.reply_to_username?.length || 0
  const isNicknameLonger = nicknameLength >= replyToLength

  if (reply.hiddenCount) {
    return (
      <div className="flex relative flex-col mb-6">
        {/*
        外部网格：处理缩进和树连接
        第1列：父级线程线（脊柱） + 连接到此评论的线（曲线）
        第2列：评论本身
      */}
        <div className="grid grid-cols-[100px_minmax(0,1fr)] relative">
          {/* 第1列：树连接区域 */}
          <div className="flex relative justify-center">
            {/* 1. 脊柱：来自父级的垂直线 */}
            {/* 如果不是最后一个子节点则穿过 */}
            {!isLast && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border -ml-px"></div>}

            {/* 脊柱延伸用于边距间隙 */}
            {/* 连接到下一个兄弟节点的 mb-6 间隙 */}
            {!isLast && <div className="absolute -bottom-6 left-1/2 w-0.5 h-6 bg-border -ml-px"></div>}

            {/* 2. 曲线：L形连接到当前评论 */}
            <svg className="absolute top-0 left-0 w-full h-12.5 pointer-events-none overflow-visible z-0 text-border">
              <path d="M 50 0 V 15 Q 50 50 85 50 H 90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* 第2列：显示更多文本 */}
          <div className="flex flex-col mt-6 min-w-0">
            <div className="flex items-center h-12.5">
              <div className="flex items-center text-muted">
                <DouyinMoreIcon size={45} className="mr-5" />
                <span className="text-4xl font-medium tracking-wide">另外 {reply.hiddenCount} 条回复</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex relative flex-col">
      {/*
        外部网格：处理缩进和树连接
        第1列：父级线程线（脊柱） + 连接到此评论的线（曲线）
        第2列：评论本身
      */}
      <div className="grid grid-cols-[100px_minmax(0,1fr)] relative">
        {/* 第1列：树连接区域 */}
        <div className="flex relative justify-center">
          {/* 1. 脊柱：来自父级的垂直线 */}
          {/* 如果不是最后一个子节点则穿过 */}
          {!isLast && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border-secondary -ml-px"></div>}

          {/* 脊柱延伸用于边距间隙 */}
          {/* 连接到下一个兄弟节点的 mb-6 间隙 */}
          {!isLast && <div className="absolute -bottom-6 left-1/2 w-0.5 h-6 bg-border -ml-px"></div>}

          {/* 2. 曲线：L形连接到当前评论 */}
          <svg className="absolute top-0 left-0 w-full h-12.5 pointer-events-none overflow-visible z-0 text-border-secondary">
            <path d="M 50 0 V 15 Q 50 50 85 50 H 90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* 第2列：评论主体（六宫格） */}
        <div className="flex flex-col min-w-0">
          {/* 内部网格：头像 | 内容 */}
          <div className="grid grid-cols-[100px_minmax(0,1fr)] relative">
            {/* 内部第1列：头像 & 子线程线 */}
            {/* 添加 h-full 以确保其拉伸以匹配内容高度 */}
            <div className="flex relative flex-col items-center h-full">
              {/* 头像 - 固定高度 */}
              <div className="w-25 h-25 shrink-0 z-10 relative">
                <img src={reply.userimageurl} className="object-cover rounded-full w-25 h-25 bg-background" alt="用户头像" />
              </div>

              {/* 子线程线 - 从头像下方开始并延伸到此单元格底部 */}
              {reply.children.length > 0 && <div className="w-0.5 bg-border-secondary h-full grow mt-3 rounded-t-full"></div>}
            </div>

            {/* 内部第2列：头部、内容、操作 */}
            <div className={cn('flex flex-col pl-6 min-w-0 gap-2', isLast && reply.children.length === 0 ? 'pb-16' : 'pb-6')}>
              {/* 第1行：头部 */}
              <div className="flex flex-nowrap items-center content-center w-full overflow-hidden">
                <span className={cn('mr-2 text-4xl font-normal text-muted', isNicknameLonger ? 'min-w-0 truncate shrink' : 'shrink-0')}>
                  {reply.nickname}
                </span>
                {reply.label_text !== '' && (
                  <div
                    className={cn(
                      'px-4 py-1 text-3xl rounded-xl mr-2',
                      reply.label_text === '作者' ? 'bg-[#fe2c55] text-white' : 'bg-surface text-muted'
                    )}
                  >
                    {reply.label_text}
                  </div>
                )}
                {reply.reply_to_username && (
                  <div className={cn('flex items-center', !isNicknameLonger ? 'overflow-hidden min-w-0 shrink' : 'shrink-0')}>
                    <PlayIcon weight="fill" className="w-7 h-auto mr-3.5 mx-1 text-muted shrink-0" />
                    <span className={cn('text-4xl font-normal text-muted', !isNicknameLonger && 'truncate')}>
                      {reply.reply_to_username}
                    </span>
                  </div>
                )}
              </div>

              {/* 第2行：内容 */}
              <div>
                <div
                  className="text-5xl text-foreground leading-normal whitespace-pre-wrap select-text"
                  style={{
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  {renderDouyinCommentRichText(reply.text)}
                </div>

                {reply.image_list &&
                  reply.image_list.length > 0 &&
                  reply.image_list.filter(Boolean).map((img, idx) => (
                    <div key={idx} className="my-4 overflow-hidden shadow-sm rounded-xl max-w-150">
                      <img className="object-contain w-full h-auto rounded-xl" src={img} alt="评论图片" />
                    </div>
                  ))}
              </div>

              {/* 第3行：操作 */}
              <div className="pb-4">
                <div className="flex gap-6 items-center text-muted">
                  <span className="text-4xl">{formatDouyinCommentTime(reply.create_time)}</span>
                  <span className="text-4xl">{reply.ip_label}</span>
                  <div className="flex gap-2 items-center">
                    <DouyinLikeIcon size={40} />
                    <span className="text-4xl select-text">{formatDouyinCommentDiggCount(reply.digg_count)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 子容器 - 递归 */}
          {reply.children.length > 0 && (
            <div className="flex relative flex-col">
              <div>
                {reply.children.map((child, index) => (
                  <ReplyItemComponent
                    key={child.cid}
                    reply={child}
                    depth={depth + 1}
                    isLast={index === reply.children.length - 1}
                    maxDepth={maxDepth}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 单个评论组件
 * @param props 组件属性
 * @returns JSX元素
 * @description Root comment component
 */
const CommentItemComponent: React.FC<DouyinCommentData['CommentsData'][number] & { isLast?: boolean; maxDepth?: number }> = (props) => {
  return (
    <div className={cn('flex flex-col px-6 pt-8', { 'pb-0': props.isLast, 'pb-10': !props.isLast })}>
      {/* 根网格 - 单列主体（根节点没有连接列） */}
      <div className="flex flex-col min-w-0">
        {/* 内部网格：头像 | 内容 */}
        <div className="grid grid-cols-[140px_minmax(0,1fr)] relative">
          {/* 内部第1列：头像 & 子线程线 */}
          <div className="flex relative flex-col items-center">
            {/* 头像 - 根节点更大 */}
            <div className="w-35 h-35 shrink-0 z-10 relative">
              <img src={props.userimageurl} className="w-35 h-35 rounded-full object-cover shadow-md bg-background" alt="用户头像" />
            </div>

            {/* 子线程线 */}
            {props.replyComment && props.replyComment.length > 0 && (
              <div className="w-0.5 bg-border-secondary h-full grow mt-4 rounded-t-full"></div>
            )}
          </div>

          {/* 内部第2列：内容 */}
          <div className="flex flex-col py-4 pl-6 min-w-0 gap-2">
            {/* 头部 */}
            <div className="flex flex-wrap gap-4 items-center mb-3 text-4xl select-text content-center">
              <span className="font-normal text-muted">{props.nickname}</span>
              {props.label_type === 1 && (
                <div className="inline-flex items-center px-3 py-1 rounded-lg text-3xl bg-[#fe2c55] text-white">作者</div>
              )}
              {props.is_author_digged && props.status_label !== '作者赞过' && (
                <div className="inline-flex items-center px-3 py-1 text-3xl font-light rounded-lg bg-surface-secondary text-foreground/80">
                  作者赞过
                </div>
              )}
              {props.status_label && (
                <div className="inline-flex items-center px-3 py-1 text-3xl font-light rounded-lg bg-surface-secondary text-foreground/80">
                  {props.status_label}
                </div>
              )}
            </div>

            <div
              className="text-5xl text-foreground leading-normal whitespace-pre-wrap select-text"
              style={{
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}
            >
              {renderDouyinCommentRichText(props.text)}
            </div>

            {/* 评论图片 */}
            {(props.commentimage || props.sticker) && (
              <div className="my-6 overflow-hidden shadow-sm rounded-2xl max-w-200">
                <img className="object-contain w-full h-auto rounded-2xl" src={props.commentimage || props.sticker} alt="评论图片" />
              </div>
            )}

            <div className="flex justify-between items-center text-muted">
              <div className="flex gap-6 items-center shrink-0">
                <span className="text-4xl">{formatDouyinCommentTime(props.create_time)}</span>
                <span className="text-4xl">{props.ip_label}</span>
                <div className="flex gap-2 items-center transition-colors cursor-pointer">
                  <DouyinLikeIcon size={44} />
                  <span className="text-4xl select-text">{formatDouyinCommentDiggCount(props.digg_count)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 回复容器 */}
        {/*
           根缩进调整：
           根头像列为 140px。中心点为 70px。
           子外部列为 100px。中心点为 50px。

           我们需要子中心点（50px）与根中心点（70px）对齐。
           所以我们需要将子元素向右推 20px。

           容器上使用 pl-5。
        */}
        {props.replyComment && props.replyComment.length > 0 && (
          <div className="flex relative flex-col mt-8 ml-5">
            <div className="absolute -top-8 left-12.5 w-0.5 h-8 bg-border-secondary -ml-px"></div>
            {organizeReplies(props.replyComment, props.cid || '', props.maxDepth).map((reply, index, arr) => (
              <ReplyItemComponent key={reply.cid} reply={reply} depth={1} isLast={index === arr.length - 1} maxDepth={props.maxDepth} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 抖音评论组件
 * @param props 组件属性
 * @returns JSX元素
 */
export const DouyinComment: React.FC<PosterProps<DouyinCommentData>> = React.memo((props) => {
  // 随机选择一个搜索词
  const randomSuggestWord = () => {
    if (props.data.suggestWrod && props.data.suggestWrod.length > 0) {
      const randomIndex = Math.floor(Math.random() * props.data.suggestWrod.length)
      return props.data.suggestWrod[randomIndex]
    }
    return null
  }

  return (
    <DefaultLayout ctx={props.ctx}>
      <div className="p-5 px-15">
        <div className="h-20"></div>
        {/* 视频信息头部 */}
        <VideoInfoHeader {...props.data} useDarkTheme={isDarkMode(props.ctx)} />

        {/* 推荐搜索词 */}
        {randomSuggestWord() && (
          <div className="mx-auto my-20 mb-5 ml-10">
            <div className="flex gap-3 items-center px-6 py-4 rounded-2xl">
              <span className="text-5xl text-muted">大家都在搜：</span>
              <span className="relative text-5xl text-[#04498d] dark:text-[#face15]">
                {randomSuggestWord()}
                <Search size={32} className="absolute -top-2 -right-8" />
              </span>
            </div>
          </div>
        )}
        {/* {randomSuggestWord && (
          <div className='mx-auto my-20 ml-10'>
            <div className='flex gap-10 items-center px-6 py-4 rounded-2xl'>
              <span className='text-5xl font-bold text-muted'>相关搜索</span>
              <span className='flex gap-2 bg-surface py-5 px-5 rounded-3xl relative text-5xl text-[#04498d] dark:text-[#face15]'>
                <Search size={50} />
                {randomSuggestWord}

              </span>
            </div>
          </div>
        )} */}

        {/* 评论列表 */}
        <div className="overflow-hidden mt-8">
          {props.data.CommentsData.length > 0 ? (
            <>
              {props.data.CommentsData.map((comment, index) => (
                <CommentItemComponent
                  key={comment.cid || index}
                  {...comment}
                  isLast={index === props.data.CommentsData.length - 1}
                  maxDepth={props.data.maxDepth}
                />
              ))}
            </>
          ) : (
            <div className="flex justify-center items-center py-20 text-muted">
              <div className="text-center">
                <p className="text-xl">暂无评论数据</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DefaultLayout>
  )
})

export default DouyinComment
