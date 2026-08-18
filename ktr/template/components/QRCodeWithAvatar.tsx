import React from 'react'

import { generateQRCode } from '../../utils/QRcode'
import { loadQRCodeAvatar } from '../../utils/QRCodeAvatar'

export interface QRCodeWithAvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** 二维码编码内容。 */
  value: string
  /** 二维码中心使用的主体头像 URL；为空时生成普通二维码。 */
  avatarUrl?: string
  /** 是否按深色主题生成二维码。 */
  useDarkTheme?: boolean
}

const QRCodeImage: React.FC<QRCodeWithAvatarProps & { avatar?: Uint8Array }> = ({
  value,
  avatarUrl: _,
  useDarkTheme = false,
  avatar,
  alt = '二维码',
  ...imageProps
}) => <img {...imageProps} src={generateQRCode(value, useDarkTheme, avatar)} alt={alt} />

/** Node SSR 版本：在服务端流式渲染期间等待头像二进制。 */
const QRCodeWithAvatarServer = async (props: QRCodeWithAvatarProps) => {
  const avatar = await loadQRCodeAvatar(props.avatarUrl)
  return <QRCodeImage {...props} avatar={avatar} />
}

/** 浏览器版本：保持同步组件语义，通过 effect 异步补充头像二维码。 */
const QRCodeWithAvatarClient: React.FC<QRCodeWithAvatarProps> = (props) => {
  const [avatar, setAvatar] = React.useState<Uint8Array>()

  React.useEffect(() => {
    let active = true
    setAvatar(undefined)

    void loadQRCodeAvatar(props.avatarUrl).then((image) => {
      if (active) setAvatar(image)
    })

    return () => {
      active = false
    }
  }, [props.avatarUrl])

  return <QRCodeImage {...props} avatar={avatar} />
}

export const QRCodeWithAvatar = typeof window === 'undefined' ? React.memo(QRCodeWithAvatarServer) : React.memo(QRCodeWithAvatarClient)

QRCodeWithAvatar.displayName = 'QRCodeWithAvatar'
