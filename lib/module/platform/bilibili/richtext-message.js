/** 将宿主无关的 B 站富文本节点映射为当前云崽协议的消息段。 */
export const mapBilibiliRichTextNodesToSegments = (nodes, segmentFactory) => {
    const messages = [];
    for (const node of nodes) {
        if (node.type === 'text') {
            if (!node.text.trim())
                continue;
            messages.push(segmentFactory.text(node.text));
            continue;
        }
        if (!node.src.trim())
            continue;
        messages.push(segmentFactory.image(node.src));
    }
    return messages;
};
/**
 * 统一调用云崽合并转发接口。空文章不触发宿主 API，避免发送空转发消息。
 */
export const createBilibiliRichTextForwardMessage = async (nodes, options) => {
    const messages = mapBilibiliRichTextNodesToSegments(nodes, options.segmentFactory);
    if (!messages.length)
        return null;
    return await options.makeForwardMsg(messages, options.title || '专栏内容');
};
