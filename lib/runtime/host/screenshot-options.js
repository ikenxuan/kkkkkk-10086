import sharp from 'sharp';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const toBuffer = (value) => {
    if (Buffer.isBuffer(value))
        return value;
    if (value instanceof Uint8Array)
        return Buffer.from(value);
    if (typeof value !== 'string')
        return null;
    const base64 = value.replace(/^base64:\/\//, '').replace(/^data:image\/\w+;base64,/, '');
    if (base64 === value && !value.startsWith('data:image/'))
        return null;
    try {
        return Buffer.from(base64, 'base64');
    }
    catch {
        return null;
    }
};
const encodeLike = (source, payload) => {
    if (source.startsWith('base64://')) {
        return `base64://${payload.toString('base64')}`;
    }
    if (source.startsWith('data:image/')) {
        return `data:image/png;base64,${payload.toString('base64')}`;
    }
    return source;
};
const getPayload = (image) => {
    if (!isRecord(image))
        return image;
    if ('file' in image)
        return image.file;
    if (isRecord(image.data) && 'file' in image.data)
        return image.data.file;
    if (typeof image.data === 'string')
        return image.data;
    return image;
};
const setPayload = (image, payload) => {
    if (typeof image === 'string')
        return encodeLike(image, payload);
    if (!isRecord(image))
        return payload;
    if ('file' in image) {
        return {
            ...image,
            file: typeof image.file === 'string' ? encodeLike(image.file, payload) : payload
        };
    }
    if (isRecord(image.data) && 'file' in image.data) {
        return {
            ...image,
            data: {
                ...image.data,
                file: typeof image.data.file === 'string' ? encodeLike(image.data.file, payload) : payload
            }
        };
    }
    if (typeof image.data === 'string') {
        return { ...image, data: encodeLike(image.data, payload) };
    }
    return { ...image, file: payload };
};
/** Request PNG encoding for all KKK-generated screenshots. */
export const withPngScreenshot = (data) => ({
    ...data,
    imgType: 'png'
});
/**
 * Yunzai's multi-page renderer currently overrides imgType to JPEG. Convert
 * the returned segment payload after rendering so the plugin's public output
 * remains PNG without modifying the host renderer.
 */
export const convertScreenshotToPng = async (image) => {
    const input = toBuffer(getPayload(image));
    if (!input || input.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE))
        return image;
    try {
        const output = await sharp(input).png().toBuffer();
        return setPayload(image, output);
    }
    catch {
        // A protocol may return a non-image payload alongside an image segment.
        // Do not make an otherwise successful render fail in the compatibility layer.
        return image;
    }
};
