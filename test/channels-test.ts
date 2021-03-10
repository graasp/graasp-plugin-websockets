import { createWsChannels, createWsClients, clientsExpect, showResults, Test } from './test-utils'

const {channels, wss} = createWsChannels()

channels.channelCreate('1')
channels.channelCreate('2')

const subs1 = createWsClients(5)
subs1.forEach(client => {
    client.on('open', () => { client.send('1') })
})

const subs2 = createWsClients(5)
subs2.forEach(client => {
    client.on('open', () => { client.send('2') })
})

const res1 = clientsExpect(subs1, 'msg1')
const res2 = clientsExpect(subs2, 'msg2')

channels.channelSend('1', 'msg1')
channels.channelSend('2', 'msg2')

showResults([new Test('Test 1', res1), new Test('Test 2', res2)])