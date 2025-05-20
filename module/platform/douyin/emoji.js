export default async function Emoji (data) {
  const ListArray = []

  for (let i = 0; i < data.emoji_list.length; i++) {
    const display_name = data.emoji_list[i].display_name
    const url = data.emoji_list[i].emoji_url.url_list[0]

    const Objject = {
      name: display_name,
      url
    }
    ListArray.push(Objject)
  }
  return ListArray
}
