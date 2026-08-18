import { renderRichTextToReact } from '@kkk/richtext'
import React from 'react'

import { DefaultLayout } from '../../../../components/DefaultLayout'
import type { PosterProps } from '../../../../types/ctx'
import { BilibiliAdditionalCard } from '../../components/AdditionalCard'
import { BilibiliDynamicFooter, BilibiliDynamicStatus, BilibiliDynamicUserInfo } from '../../components/CommonComponents'
import type { BilibiliWordContentProps } from '../../types'
import type { BilibiliWordDynamicData } from './types'

/**
 * B站纯文动态内容组件
 */
const BilibiliWordContent: React.FC<BilibiliWordContentProps> = (props) => {
  return (
    <>
      {/* 文本内容 */}
      <div className="flex flex-col px-20 w-full leading-relaxed">
        <div
          className="text-[60px] tracking-[0.5px] leading-[1.6] whitespace-pre-wrap text-foreground mb-5 select-text"
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word'
          }}
        >
          {props.text &&
            renderRichTextToReact(props.text, {
              at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
            })}
        </div>
        <div className="h-15" />
      </div>

      {/* 相关卡片 */}
      {props.additional && <BilibiliAdditionalCard additional={props.additional} />}
    </>
  )
}

/**
 * B站纯文动态组件
 */
export const BilibiliWordDynamic: React.FC<PosterProps<BilibiliWordDynamicData>> = React.memo((props) => {
  return (
    <DefaultLayout ctx={props.ctx}>
      <div className="p-4">
        <div className="h-25" />
        <BilibiliDynamicUserInfo {...props.data} />
        <div className="h-15" />
        <BilibiliWordContent text={props.data.text} additional={props.data.additional} />
        <BilibiliDynamicStatus {...props.data} />

        <div className="h-23" />
        <BilibiliDynamicFooter {...props.data} />
      </div>
    </DefaultLayout>
  )
})

BilibiliWordDynamic.displayName = 'BilibiliWordDynamic'

export default BilibiliWordDynamic
