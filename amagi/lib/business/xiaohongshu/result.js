import { XiaohongshuData } from '../../business/xiaohongshu/index.js';
export default async function XiaohongshuResult(config = { cookie: '' }, options = {}) {
    let result;
    switch (config.type) {
        case "\u5355\u4E2A\u7B14\u8BB0" /* XiaohongshuDataType.单个笔记 */: {
            result = await new XiaohongshuData(config.type, config.cookie).GetData(options);
            break;
        }
        default:
            result = '';
            break;
    }
    return {
        code: result !== false && result !== '' ? 200 : 503,
        message: result !== false && result !== '' ? 'success' : 'error',
        data: result !== false && result !== '' ? result : null
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2J1c2luZXNzL3hpYW9ob25nc2h1L3Jlc3VsdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNEJBQTRCLENBQUE7QUFRNUQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFVBQVUsaUJBQWlCLENBQzdDLFNBQXVCLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBa0IsRUFDckQsVUFBVSxFQUE0QjtJQUV0QyxJQUFJLE1BQVcsQ0FBQTtJQUNmLFFBQVEsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BCLDhEQUE2QixDQUFDLENBQUMsQ0FBQztZQUM5QixNQUFNLEdBQUcsTUFBTSxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDL0UsTUFBSztRQUNQLENBQUM7UUFFRDtZQUNFLE1BQU0sR0FBRyxFQUFFLENBQUE7WUFDWCxNQUFLO0lBQ1QsQ0FBQztJQUNELE9BQU87UUFDTCxJQUFJLEVBQUUsTUFBTSxLQUFLLEtBQUssSUFBSSxNQUFNLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUc7UUFDbkQsT0FBTyxFQUFFLE1BQU0sS0FBSyxLQUFLLElBQUksTUFBTSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPO1FBQ2hFLElBQUksRUFBRSxNQUFNLEtBQUssS0FBSyxJQUFJLE1BQU0sS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSTtLQUN4RCxDQUFBO0FBRUgsQ0FBQyJ9