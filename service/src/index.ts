import express from 'express'
import type { ChatContext, ChatMessage } from './chatgpt'
import { chatConfig, chatReply, chatReplyProcess, currentModel, getApi } from './chatgpt'
import { auth } from './middleware/auth'
import { isNotEmptyString } from './utils/is'

const app = express()
const router = express.Router()

const keyMap = new Map()

app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

// 主线已废弃
router.post('/chat', async (req, res) => {
  try {
    const { prompt, options = { apiKey: '' } } = req.body as { prompt: string; options?: ChatContext }
    const { apiKey } = options
    const api = keyMap.get(apiKey)
    if (!apiKey) {
      res.send(JSON.stringify({ error: 'key is null' }))
      return
    }
    const response = await chatReply(prompt, api, options)
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/keyLogin', async (req, res) => {
  try {
    const { apiKey } = req.body as { apiKey: string }
    if (!apiKey) {
      res.send(JSON.stringify({ error: 'apiKey is null' }))
      return
    }
    if (!keyMap.get(apiKey)) {
      const api = getApi(apiKey)
      keyMap.set(apiKey, api)
    }
    res.send({ message: 'success' })
  }
  catch (error) {
    res.send(error)
  }
})

router.get('/keyList', async (req, res) => {
  try {
    const { user } = req.query as { user: string }
    if (user === 'admin_ct') {
      const arr = [...keyMap].map((item) => {
        return `${item}t`
      })

      const jsonStr = JSON.stringify(arr)
      res.send(jsonStr)
    }
    else {
      res.send(JSON.stringify({ error: 'nothing' }))
    }
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/chat-process', async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { prompt, options = { apiKey: '' } } = req.body as { prompt: string; options?: ChatContext }
    const { apiKey } = options
    if (!apiKey) {
      res.send(JSON.stringify({ error: 'key is null' }))
      return
    }

    let firstChunk = true
    await chatReplyProcess(prompt, apiKey, options, (chat: ChatMessage) => {
      res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
      firstChunk = false
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
