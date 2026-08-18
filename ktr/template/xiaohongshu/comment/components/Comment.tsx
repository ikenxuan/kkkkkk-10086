import { renderRichTextToReact } from '@kkk/richtext'
import { differenceInSeconds, format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Heart, MessageCircle } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { generateQRCode } from '../../../../utils/QRcode'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { XiaohongshuCommentData } from './types'

const xiaohongshuMentionClassName = 'text-[#13386c] dark:text-[#c7daef]'

const renderXiaohongshuCommentRichText = (content: XiaohongshuCommentData['CommentsData'][0]['content']) => {
  return renderRichTextToReact(content, {
    mention: { className: xiaohongshuMentionClassName }
  })
}

const formatXiaohongshuCommentTime = (timestamp: number): string => {
  if (!timestamp) {
    return ''
  }

  const commentDate = new Date(timestamp)
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

const formatXiaohongshuLikeCount = (count: string): string => {
  const numberCount = Number(count)
  if (Number.isFinite(numberCount) && numberCount >= 10000) {
    return `${(numberCount / 10000).toFixed(1)}w`
  }

  return count || '0'
}

/**
 * 笔记信息头部组件
 * @param props 组件属性
 * @returns JSX元素
 */
const NoteInfoHeader: React.FC<XiaohongshuCommentData & { useDarkTheme: boolean }> = (props) => {
  return (
    <div className="flex justify-between items-center max-w-300 mx-auto p-5">
      <div className="flex flex-col justify-center items-start">
        {/* Logo 图片区域 */}
        <div className="flex justify-start items-center">
          <img
            src="/image/xiaohongshu/logo.png"
            alt="小红书Logo"
            className="object-contain mb-20 max-w-full max-h-full scale-180 ml-15"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                parent.innerHTML = '<div class="flex justify-start items-center h-full text-2xl font-bold text-foreground/70">小红书</div>'
              }
            }}
          />
        </div>

        {/* 文字信息区域 */}
        <div className="mt-8 space-y-4 text-left text-muted">
          <div className="tracking-[6px] text-[45px] select-text">笔记类型：{props.Type}</div>
          <div className="tracking-[6px] text-[45px] select-text">评论数量：{props.CommentLength}条</div>
          {props.Type === '图文' && props.ImageLength && (
            <div className="tracking-[6px] text-[45px] select-text">图片数量：{props.ImageLength}张</div>
          )}
        </div>
      </div>
      <div className="flex flex-col justify-center items-center p-5">
        <div className="flex overflow-hidden justify-center items-center bg-white w-110 h-110">
          <img src={generateQRCode(props.share_url, props.useDarkTheme)} alt="二维码" className="object-contain" />
        </div>
        <p className="mt-5 text-[40px] text-muted text-center">扫码查看原笔记</p>
      </div>
    </div>
  )
}

/**
 * 单个评论组件
 * @param props 组件属性
 * @returns JSX元素
 */
const CommentItemComponent: React.FC<XiaohongshuCommentData['CommentsData'][0] & { isLast?: boolean }> = ({ ...props }, isLast = false) => {
  return (
    <div className={`flex px-10 pt-15 ${isLast ? 'pb-0' : 'pb-15'}`}>
      {/* 用户头像 */}
      <img
        src={props.user_info.image}
        className="mb-12.5 w-[187.5px] h-[187.5px] rounded-full mr-8 object-cover shadow-lg"
        alt="用户头像"
      />

      {/* 评论内容 */}
      <div className="flex-1">
        {/* 用户信息 */}
        <div className="mb-12.5 text-[50px] text-foreground/70 relative flex items-center select-text">
          <span className="text-5xl">{props.user_info.nickname}</span>
          {props.show_tags &&
            props.show_tags.length > 0 &&
            props.show_tags.map((tag, index) => {
              if (tag === 'is_author') {
                return (
                  <div key={index} className="inline-block px-6 py-3 ml-3 text-4xl rounded-full bg-surface text-muted">
                    作者
                  </div>
                )
              } else if (tag === 'user_top') {
                return (
                  <div key={index} className="inline-block px-6 py-3 rounded-full ml-3 text-4xl bg-[#ff2e4d0f] text-[#ff2e4d]">
                    置顶评论
                  </div>
                )
              } else {
                return null
              }
            })}
        </div>

        {/* 评论文本 */}
        <div
          className="text-[60px] text-foreground leading-relaxed mb-2 whitespace-pre-wrap select-text"
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word'
          }}
        >
          {renderXiaohongshuCommentRichText(props.content)}
        </div>

        {/* 评论图片 */}
        {props.pictures && props.pictures.length > 0 && (
          <div className="flex my-5 overflow-hidden shadow-md rounded-2xl w-[95%] flex-1">
            <img className="object-contain w-full h-full rounded-2xl" src={props.pictures[0].url_default} alt="评论图片" />
          </div>
        )}

        {/* 底部信息和操作区域 */}
        <div className="flex justify-between items-center mt-6 text-muted">
          <div className="flex items-center space-x-6 select-text">
            <span className="text-[45px]">{formatXiaohongshuCommentTime(props.create_time)}</span>
            <span className="text-[45px]">{props.ip_location}</span>
            {parseInt(props.sub_comment_count) > 0 ? (
              <span className="text-[40px] text-foreground/70">共{props.sub_comment_count}条回复</span>
            ) : (
              <span className="text-[40px] text-foreground/70">回复</span>
            )}
          </div>

          <div className="flex items-center space-x-6">
            {/* 点赞按钮 */}
            <div className="flex items-center space-x-2 transition-colors cursor-pointer">
              <Heart size={60} className={props.liked ? 'text-red-500 fill-current' : 'text-muted'} />
              <span className="text-[50px] select-text">{formatXiaohongshuLikeCount(props.like_count)}</span>
            </div>

            {/* 回复按钮 */}
            <div className="flex items-center transition-colors cursor-pointer">
              <MessageCircle size={60} className="stroke-current text-muted" />
            </div>
          </div>
        </div>

        {/* 子评论 */}
        {props.sub_comments && props.sub_comments.length > 0 && (
          <div className="pl-6 mt-6">
            {props.sub_comments.map((subComment, index) => (
              <div key={subComment.id} className={`py-4 ${index !== props.sub_comments.length - 1 ? 'border-b border-divider' : ''}`}>
                <div className="flex items-start space-x-4">
                  <img src={subComment.user_info.image} className="object-cover mr-8 w-32 h-32 rounded-full" alt="用户头像" />
                  <div className="flex-1">
                    <div className="flex items-center mb-2 space-x-2">
                      <span className="text-[40px] font-medium text-foreground/70">{subComment.user_info.nickname}</span>
                      {subComment.show_tags &&
                        subComment.show_tags.length > 0 &&
                        subComment.show_tags.map((tag, tagIndex) =>
                          tag === 'is_author' ? (
                            <div key={tagIndex} className="inline-block px-5 py-2 ml-2 text-3xl rounded-full bg-surface text-muted">
                              作者
                            </div>
                          ) : null
                        )}
                    </div>
                    <div
                      className="text-[45px] text-foreground leading-relaxed mb-2 whitespace-pre-wrap select-text"
                      style={{
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                      }}
                    >
                      {renderRichTextToReact(subComment.content, {
                        mention: { className: xiaohongshuMentionClassName }
                      })}
                    </div>
                    <div className="flex justify-between items-center text-muted">
                      <div className="flex items-center space-x-4">
                        <span className="text-[35px]">{formatXiaohongshuCommentTime(subComment.create_time)}</span>
                        <span className="text-[35px]">{subComment.ip_location}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Heart size={40} className={subComment.liked ? 'text-red-500 fill-current' : 'text-muted'} />
                        <span className="text-[35px]">{formatXiaohongshuLikeCount(subComment.like_count)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 小红书评论组件
 * @param props 组件属性
 * @returns JSX元素
 */
export const XiaohongshuComment: React.FC<PosterProps<XiaohongshuCommentData>> = React.memo((props) => {
  return (
    <DefaultLayout ctx={props.ctx}>
      <div className="h-30" />
      {/* 页面头部 */}
      <NoteInfoHeader {...props.data} useDarkTheme={isDarkMode(props.ctx)} />

      {/* 评论列表 */}
      <div className="overflow-auto mx-20 max-w-full">
        {props.data.CommentsData.length > 0 ? (
          <div className="divide-y divide-divider">
            {props.data.CommentsData.map((comment, index) => (
              <CommentItemComponent key={comment.id} {...comment} isLast={index === props.data.CommentsData.length - 1} />
            ))}
          </div>
        ) : (
          <div className="flex justify-center items-center py-20">
            <p className="text-[60px] text-muted">暂无评论</p>
          </div>
        )}
      </div>
    </DefaultLayout>
  )
})

export default XiaohongshuComment
