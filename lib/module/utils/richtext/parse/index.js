export const createTextNode = (text, style) => ({
    type: 'text',
    text,
    style
});
export const createEmojiNode = (name, src, options = {}) => ({
    type: 'emoji',
    name,
    src,
    scale: options.scale
});
export const createMentionNode = (text, userId) => ({
    type: 'mention',
    text,
    userId
});
export const createSearchKeywordNode = (text, queryId) => ({
    type: 'searchKeyword',
    text,
    queryId
});
export const createLineBreakNode = () => ({
    type: 'lineBreak'
});
export const createTopicNode = (text) => ({
    type: 'topic',
    text
});
export const createAtNode = (text, userId) => ({
    type: 'at',
    text,
    userId
});
export const createLotteryNode = (text) => ({
    type: 'lottery',
    text
});
export const createWebLinkNode = (text, jumpUrl) => ({
    type: 'webLink',
    text,
    jumpUrl
});
export const createVoteNode = (text) => ({
    type: 'vote',
    text
});
export const createViewPictureNode = (text) => ({
    type: 'viewPicture',
    text
});
/*
 * 这里原来还有 9 个 block 级节点的构造函数（heading / paragraph / image /
 * horizontalRule / blockquote / list / listItem / codeBlock / linkCard），
 * 全部零引用，已删。
 *
 * 别照着上面的 inline 构造函数把它们补回来：block 节点唯一的生产者是
 * `platform/bilibili/dynamicText.ts`，它按对象字面量直接造（`{ type: 'heading', ... }`），
 * 因为那边是从 B 站专栏的 HTML 树递归转换、需要在一处同时决定 type 和字段。
 * 渲染侧（ktr/richtext/react）按 `node.type` 判别，不依赖谁构造的。
 * inline 那批构造函数是活的，被 dynamicText 的行内解析和其他平台共用。
 */
/**
 * 创建 hashtag 节点。
 *
 * 纯文本高亮，不带任何图标。适用于抖音等平台的 #话题# 展示。
 */
export const createHashtagNode = (text) => ({
    type: 'hashtag',
    text
});
/**
 * 合并相邻文本节点并丢弃空文本节点。
 *
 * 这样 core 可以按匹配过程简单 push 节点，最后统一整理，避免前端拿到碎片过多的数据。
 */
export const normalizeRichTextNodes = (nodes) => {
    const normalized = [];
    for (const node of nodes) {
        if (node.type === 'text') {
            if (node.text.length === 0) {
                continue;
            }
            const previousNode = normalized[normalized.length - 1];
            if (previousNode?.type === 'text') {
                previousNode.text += node.text;
                continue;
            }
        }
        normalized.push(node);
    }
    return normalized;
};
/**
 * 从富文本文档中提取纯文本内容。
 *
 * lineBreak 节点映射为空字符串（不参与长度计数），图片节点被忽略。
 */
export const extractRichTextPlainText = (document) => {
    const extractFromNode = (node) => {
        switch (node.type) {
            case 'text':
            case 'mention':
            case 'searchKeyword':
            case 'topic':
            case 'at':
            case 'lottery':
            case 'webLink':
            case 'vote':
            case 'viewPicture':
            case 'hashtag':
            case 'emoji':
                return 'text' in node ? (node.text ?? '') : (node.name ?? '');
            case 'heading':
            case 'paragraph':
            case 'blockquote':
            case 'listItem':
                return node.nodes.map(extractFromNode).join('');
            case 'list':
                return node.items.map(extractFromNode).join('');
            case 'lineBreak':
            case 'horizontalRule':
                return '';
            case 'image':
                return '';
            case 'codeBlock':
                return node.content;
            case 'linkCard':
                return node.title;
            default:
                return '';
        }
    };
    return document.nodes.map(extractFromNode).join('');
};
/**
 * 创建富文本文档。
 *
 * 这里不会生成任何 HTML，只返回可序列化 JSON，适合作为 core 到 template 的数据边界。
 */
export const createRichTextDocument = (nodes, options = {}) => ({
    version: 1,
    platform: options.platform,
    nodes: normalizeRichTextNodes(nodes)
});
