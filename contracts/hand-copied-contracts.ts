/**
 * 手抄契约副本的防漂移断言。
 *
 * `src/` 里有几处为了绕开 TS6059 而手抄的模板契约副本（根 program 的 `rootDir` 是 `./src`，
 * 直接 import `ktr/**` 的 .ts 进不去）。手抄的东西迟早会跟本体对不上，所以在这个
 * program 里把两边钉住：形状一旦不兼容，`pnpm typecheck:render` 就红。
 *
 * 这不是「把契约挪进 src/」的替代品，是在不挪上游文件的前提下拿到同等的编译期保障。
 *
 * **为什么用可赋值性而不是严格相等**：先写的是双向 identity 的 `Equals<>`，结果两条都红，
 * 但查下来根因是上游契约自己糊：`is_At_user_id?: any`、`text_extra: any[]`，
 * 而手抄副本写的是 `string[] | null`、`RawTextExtra[]` —— 副本比契约更精确，
 * 这是安全的方向，不是漂移。真正要保证的是「副本能当模板入参用」，也就是单向可赋值：
 * - 契约新增必填字段而副本没有 → 不可赋值，报错 ✅
 * - 契约改了某字段的类型 → 不可赋值，报错 ✅
 * - 契约放宽某字段（`string` → `string | null`）→ 仍可赋值，不报错 ✅（副本更窄，没问题）
 * - 契约删字段而副本还留着 → 不报错。这是死字段，不是 bug，不值得为它引入误报。
 */
import type { BilibiliDecorationCard } from '@/module/platform/bilibili/bilibili'
import type { DouyinComment, DouyinReplyComment } from '@/module/platform/douyin/comments'
import type { DecorationCardData } from '../ktr/template/bilibili/dynamic/types'
import type { DouyinCommentData } from '../ktr/template/douyin/comment/components/types'
import type { DouyinSubComment } from '../ktr/template/douyin/components/types'

/** `Sub` 不能赋给 `Super` 就报错 */
type MustExtend<Sub extends Super, Super> = Sub

/** 主评论：`comments.ts` 的 DouyinComment 必须能当模板的评论项用 */
export type DouyinCommentMatchesContract =
  MustExtend<DouyinComment, DouyinCommentData['CommentsData'][number]>

/** 子评论：`comments.ts` 的 DouyinReplyComment 必须能当模板的 DouyinSubComment 用 */
export type DouyinReplyCommentMatchesContract =
  MustExtend<DouyinReplyComment, DouyinSubComment>

/** B站粉丝装饰卡片：`bilibili.ts` 的手抄副本必须能当模板的 DecorationCardData 用 */
export type BilibiliDecorationCardMatchesContract =
  MustExtend<BilibiliDecorationCard, DecorationCardData>
