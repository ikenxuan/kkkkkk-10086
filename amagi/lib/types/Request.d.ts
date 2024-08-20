import { FastifyRequest } from 'fastify'
import { BilibiliOptionsType, DouyinOptionsType } from './OptionsType.js'
export interface DouyinRequest extends FastifyRequest {
    Querystring: DouyinOptionsType;
}
export interface BilibiliRequest extends FastifyRequest {
    Querystring: BilibiliOptionsType;
}
