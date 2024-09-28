class XiaohongshuAPI {
  单个笔记 (data) {
    return {
      url: 'https://edith.xiaohongshu.com/api/sns/web/v1/feed',
      method: 'POST',
      body: {
        source_note_id: data.source_note_id,
        image_formats: [ 'jpg', 'webp', 'avif' ],
        extra: { need_body_topic: 1 },
        xsec_source: 'pc_feed',
        xsec_token: data.xsec_token
      }
    }
  }
}
export default new XiaohongshuAPI()
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQUlQLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2J1c2luZXNzL3hpYW9ob25nc2h1L0FJUC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxNQUFNLGNBQWM7SUFDbEIsSUFBSSxDQUFFLElBQXFEO1FBQ3pELE9BQU87WUFDTCxHQUFHLEVBQUUsbURBQW1EO1lBQ3hELE1BQU0sRUFBRSxNQUFNO1lBQ2QsSUFBSSxFQUFFO2dCQUNKLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYztnQkFDbkMsYUFBYSxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUM7Z0JBQ3RDLEtBQUssRUFBRSxFQUFFLGVBQWUsRUFBRSxDQUFDLEVBQUU7Z0JBQzdCLFdBQVcsRUFBRSxTQUFTO2dCQUN0QixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7YUFDNUI7U0FDRixDQUFBO0lBQ0gsQ0FBQztDQUNGO0FBV0QsZUFBZSxJQUFJLGNBQWMsRUFBRSxDQUFBIn0=