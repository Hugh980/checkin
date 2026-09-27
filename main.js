const isAlreadyCheckedIn = (message = '', code) => {
  const text = String(message).toLowerCase()
  return Number(code) === 1 ||
    text.includes('today\'s observation logged') ||
    text.includes('return tomorrow') ||
    text.includes('please try tomorrow') ||
    text.includes('already check') ||
    text.includes('checkin repeats') ||
    text.includes('今日已签到') ||
    text.includes('已经签到') ||
    text.includes('明天再试')
}

const glados = async () => {
  const notice = []
  let failed = false

  if (!process.env.GLADOS) {
    return { notice: ['Checkin Error', 'GLADOS secret is empty'], failed: true }
  }

  const domain = process.env.DOMAIN || 'glados.vip'
  const origin = `https://${domain}`

  for (const cookie of String(process.env.GLADOS).split('\n')) {
    if (!cookie.trim()) continue

    try {
      const common = {
        'cookie': cookie.trim(),
        'accept': 'application/json, text/plain, */*',
        'origin': origin,
        'referer': `${origin}/console/checkin`,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
      }

      // Validate the session on the same domain that will be used for check-in.
      const before = await fetch(`${origin}/api/user/status`, {
        method: 'GET',
        headers: common,
      }).then((r) => r.json())

      if (before?.code || !before?.data) {
        throw new Error(before?.message || `Not logged in on ${domain}`)
      }

      const action = await fetch(`${origin}/api/user/checkin`, {
        method: 'POST',
        headers: {
          ...common,
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify({ token: domain }),
      }).then((r) => r.json())

      if (action?.code && !isAlreadyCheckedIn(action?.message, action?.code)) {
        throw new Error(action?.message || 'Check-in failed')
      }

      const status = await fetch(`${origin}/api/user/status`, {
        method: 'GET',
        headers: common,
      }).then((r) => r.json())

      if (status?.code || !status?.data) {
        throw new Error(status?.message || 'Failed to read account status')
      }

      notice.push(
        isAlreadyCheckedIn(action?.message, action?.code) ? 'Checkin Already Done' : 'Checkin OK',
        `${action?.message || 'Success'}`,
        `Domain ${domain}`,
        `Left Days ${Number(status?.data?.leftDays)}`
      )
    } catch (error) {
      failed = true
      notice.push(
        'Checkin Error',
        `${error}`,
        `Domain ${domain}`,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }

  return { notice, failed }
}

const notify = async (notice) => {
  if (!process.env.NOTIFY || !notice) return

  for (const option of String(process.env.NOTIFY).split('\n')) {
    if (!option) continue

    if (option.startsWith('console:')) {
      for (const line of notice) console.log(line)
    } else if (option.startsWith('wxpusher:')) {
      await fetch('https://wxpusher.zjiecode.com/api/send/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appToken: option.split(':')[1],
          summary: notice[0],
          content: notice.join('<br>'),
          contentType: 3,
          uids: option.split(':').slice(2),
        }),
      })
    } else if (option.startsWith('pushplus:')) {
      await fetch('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: option.split(':')[1],
          title: notice[0],
          content: notice.join('<br>'),
          template: 'markdown',
        }),
      })
    } else if (option.startsWith('bark:')) {
      await fetch(`https://api.day.app/${option.split(':')[1]}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: notice[0],
          body: notice.slice(1).join('\n'),
        }),
      })
    } else if (option.startsWith('qyweixin:')) {
      const key = option.split(':')[1]
      await fetch(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: { content: notice.join('<br>') },
        }),
      })
    } else {
      await fetch('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: option,
          title: notice[0],
          content: notice.join('<br>'),
          template: 'markdown',
        }),
      })
    }
  }
}

const main = async () => {
  const { notice, failed } = await glados()
  await notify(notice)
  if (failed) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
