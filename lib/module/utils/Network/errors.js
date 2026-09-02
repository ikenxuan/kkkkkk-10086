import axios, { AxiosError } from 'axios';
export function toAxiosError(error) {
    if (axios.isAxiosError(error))
        return error;
    if (error instanceof Error) {
        return AxiosError.from(error, getErrorCode(error));
    }
    return new AxiosError(String(error));
}
function getErrorCode(error) {
    const code = Reflect.get(error, 'code');
    return typeof code === 'string' ? code : undefined;
}
export function isSslError(error) {
    return error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        error.code === 'ERR_SSL_WRONG_VERSION_NUMBER' ||
        Boolean(error.message?.includes('SSL'));
}
export async function delay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
